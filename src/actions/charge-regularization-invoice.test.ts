import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { requireSocietyActionContext } = vi.hoisted(() => ({
  requireSocietyActionContext: vi.fn(),
}));
vi.mock("@/lib/action-society", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/action-society")>();
  return { ...actual, requireSocietyActionContext };
});

import { generateInvoiceFromRegularization } from "./charge-regularization-invoice";
import { createAuditLog } from "@/lib/audit";

const baseRegularization = {
  id: "reg-1",
  societyId: "soc-1",
  leaseId: "lease-1",
  fiscalYear: 2024,
  periodStart: new Date("2024-01-01"),
  periodEnd: new Date("2024-12-31"),
  totalCharges: 1200,
  totalProvisions: 800,
  balance: 400,
  isFinalized: true,
  finalizedAt: new Date(),
  lease: {
    id: "lease-1",
    tenantId: "tenant-1",
    lot: { id: "lot-1", building: { id: "building-1" } },
  },
};

describe("generateInvoiceFromRegularization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSocietyActionContext.mockResolvedValue({ userId: "user-1", societyId: "soc-1" });
  });

  it("retourne une erreur si non autorise", async () => {
    requireSocietyActionContext.mockRejectedValue(new Error("Non autorise"));
    const result = await generateInvoiceFromRegularization("soc-1", "reg-1");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si la regularisation n'existe pas", async () => {
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(null);
    const result = await generateInvoiceFromRegularization("soc-1", "reg-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne une erreur si la regularisation n'est pas finalisee", async () => {
    prismaMock.chargeRegularization.findFirst.mockResolvedValue({
      ...baseRegularization,
      isFinalized: false,
    } as never);
    const result = await generateInvoiceFromRegularization("soc-1", "reg-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("finalis");
  });

  it("retourne une erreur si le solde est negatif ou nul", async () => {
    prismaMock.chargeRegularization.findFirst.mockResolvedValue({
      ...baseRegularization,
      balance: -100,
    } as never);
    const result = await generateInvoiceFromRegularization("soc-1", "reg-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("solde");
  });

  it("retourne une erreur si une facture de regularisation existe deja pour ce bail et cette periode", async () => {
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(baseRegularization as never);
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "invoice-existing" } as never);
    const result = await generateInvoiceFromRegularization("soc-1", "reg-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("existe");
  });

  it("cree une facture brouillon avec le solde comme montant", async () => {
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(baseRegularization as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: "invoice-new" } as never);

    const result = await generateInvoiceFromRegularization("soc-1", "reg-1");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.invoiceId).toBe("invoice-new");
    expect(prismaMock.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: "soc-1",
          tenantId: "tenant-1",
          leaseId: "lease-1",
          invoiceType: "REGULARISATION_CHARGES",
          status: "BROUILLON",
          totalHT: 400,
          totalTTC: 400,
          totalVAT: 0,
          periodStart: baseRegularization.periodStart,
          periodEnd: baseRegularization.periodEnd,
        }),
      })
    );
  });

  it("cree une ligne de facture avec la description de regularisation", async () => {
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(baseRegularization as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: "invoice-new" } as never);

    await generateInvoiceFromRegularization("soc-1", "reg-1");

    expect(prismaMock.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                label: expect.stringContaining("2024"),
                quantity: 1,
                unitPrice: 400,
                vatRate: 0,
              }),
            ]),
          }),
        }),
      })
    );
  });

  it("cree un audit log apres creation de la facture", async () => {
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(baseRegularization as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: "invoice-new" } as never);

    await generateInvoiceFromRegularization("soc-1", "reg-1");

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Invoice",
        entityId: "invoice-new",
        details: expect.objectContaining({
          event: "REGULARISATION_INVOICE_GENERATED",
          regularizationId: "reg-1",
        }),
      })
    );
  });
});