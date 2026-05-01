import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getVatControl, liquidateVatPeriod } from "./vat-control";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("getVatControl", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();

    const result = await getVatControl(SOCIETY_ID);

    expect(result.success).toBe(false);
  });

  it("rapproche TVA comptable, factures clients et factures fournisseurs", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        debit: 0,
        credit: 200,
        account: { id: "vat-collected", code: "445710", label: "TVA collectée" },
      },
      {
        debit: 50,
        credit: 0,
        account: { id: "vat-deductible", code: "445660", label: "TVA déductible" },
      },
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      { totalVAT: 120 },
      { totalVAT: 80 },
    ] as never);
    prismaMock.supplierInvoice.aggregate.mockResolvedValue({
      _sum: { amountVAT: 50 },
    } as never);

    const result = await getVatControl(SOCIETY_ID, {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      accounting: { collected: 200, deductible: 50, netDue: 150 },
      business: { customerVat: 200, supplierVat: 50, netDue: 150 },
      discrepancies: { collected: 0, deductible: 0, netDue: 0 },
    });
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({
            entryDate: {
              gte: new Date("2026-01-01"),
              lte: new Date("2026-01-31"),
            },
          }),
        }),
      })
    );
  });

  it("remonte les écarts de TVA", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        debit: 0,
        credit: 240,
        account: { id: "vat-collected", code: "445710", label: "TVA collectée" },
      },
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([{ totalVAT: 200 }] as never);
    prismaMock.supplierInvoice.aggregate.mockResolvedValue({
      _sum: { amountVAT: null },
    } as never);

    const result = await getVatControl(SOCIETY_ID);

    expect(result.success).toBe(true);
    expect(result.data?.discrepancies.collected).toBe(40);
    expect(result.data?.discrepancies.netDue).toBe(40);
  });
});

describe("liquidateVatPeriod", () => {
  it("crée une écriture de liquidation TVA idempotente", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntry.findFirst.mockResolvedValueOnce(null);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        debit: 0,
        credit: 200,
        account: { id: "vat-collected", code: "445710", label: "TVA collectée" },
      },
      {
        debit: 50,
        credit: 0,
        account: { id: "vat-deductible", code: "445660", label: "TVA déductible" },
      },
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([{ totalVAT: 200 }] as never);
    prismaMock.supplierInvoice.aggregate.mockResolvedValue({
      _sum: { amountVAT: 50 },
    } as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.journalEntry.findFirst.mockResolvedValueOnce(null);
    prismaMock.accountingAccount.upsert.mockResolvedValue({ id: "vat-due" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: "vat-entry" } as never);

    const result = await liquidateVatPeriod(SOCIETY_ID, {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    expect(result).toEqual({ success: true, data: { id: "vat-entry", alreadyExists: false } });
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "OD",
          reference: "vat-liquidation:2026-01-01:2026-01-31",
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({ accountId: "vat-collected", debit: 200, credit: 0 }),
              expect.objectContaining({ accountId: "vat-deductible", debit: 0, credit: 50 }),
              expect.objectContaining({ accountId: "vat-due", debit: 0, credit: 150 }),
            ]),
          },
        }),
      })
    );
  });

  it("bloque la liquidation si le contrôle TVA présente des écarts", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        debit: 0,
        credit: 240,
        account: { id: "vat-collected", code: "445710", label: "TVA collectée" },
      },
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([{ totalVAT: 200 }] as never);
    prismaMock.supplierInvoice.aggregate.mockResolvedValue({
      _sum: { amountVAT: null },
    } as never);

    const result = await liquidateVatPeriod(SOCIETY_ID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/écarts/);
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });
});
