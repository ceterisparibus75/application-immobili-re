import { describe, expect, it } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getVatControl } from "./vat-control";

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
          journalEntry: {
            entryDate: {
              gte: new Date("2026-01-01"),
              lte: new Date("2026-01-31"),
            },
          },
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
