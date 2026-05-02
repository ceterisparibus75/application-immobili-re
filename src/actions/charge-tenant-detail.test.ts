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

import { getTenantChargeDetail } from "./charge-tenant-detail";

const mockLease = (id: string, tenantFirstName: string, tenantLastName: string, lotNumber: string, monthly: number) => ({
  id,
  tenantId: `tenant-${id}`,
  tenant: {
    id: `tenant-${id}`,
    entityType: "PERSONNE_PHYSIQUE",
    firstName: tenantFirstName,
    lastName: tenantLastName,
    companyName: null,
  },
  lot: { number: lotNumber },
  chargeProvisions: [
    { monthlyAmount: monthly, startDate: new Date("2024-01-01"), endDate: null, isActive: true },
  ],
});

describe("getTenantChargeDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSocietyActionContext.mockResolvedValue({ userId: "user-1", societyId: "soc-1" });
  });

  it("retourne une erreur si non autorise", async () => {
    requireSocietyActionContext.mockRejectedValue(new Error("Non autorise"));
    const result = await getTenantChargeDetail("soc-1", "building-1", 2024);
    expect(result.success).toBe(false);
  });

  it("retourne une liste vide si aucun bail", async () => {
    prismaMock.lease.findMany.mockResolvedValue([]);
    prismaMock.chargeRegularization.findMany.mockResolvedValue([]);
    const result = await getTenantChargeDetail("soc-1", "building-1", 2024);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("retourne les provisions annuelles par locataire", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      mockLease("l1", "Jean", "Dupont", "A01", 100),
      mockLease("l2", "Marie", "Martin", "A02", 50),
    ] as never);
    prismaMock.chargeRegularization.findMany.mockResolvedValue([]);

    const result = await getTenantChargeDetail("soc-1", "building-1", 2024);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      const jean = result.data?.find((r) => r.tenantName === "Jean Dupont");
      expect(jean?.totalProvisions).toBe(1200);
      expect(jean?.lotNumber).toBe("A01");
    }
  });

  it("enrichit avec les donnees de regularisation si disponible", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      mockLease("l1", "Jean", "Dupont", "A01", 100),
    ] as never);
    prismaMock.chargeRegularization.findMany.mockResolvedValue([
      {
        leaseId: "l1",
        fiscalYear: 2024,
        totalCharges: 1500,
        totalProvisions: 1200,
        balance: 300,
        isFinalized: true,
      },
    ] as never);

    const result = await getTenantChargeDetail("soc-1", "building-1", 2024);
    expect(result.success).toBe(true);
    if (result.success) {
      const jean = result.data?.[0];
      expect(jean?.hasRegularization).toBe(true);
      expect(jean?.balance).toBe(300);
      expect(jean?.totalChargesAllocated).toBe(1500);
    }
  });

  it("marque une PERSONNE_MORALE avec le nom de societe", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "l1",
        tenantId: "tenant-l1",
        tenant: { id: "tenant-l1", entityType: "PERSONNE_MORALE", firstName: null, lastName: null, companyName: "SARL Immoval" },
        lot: { number: "B01" },
        chargeProvisions: [],
      },
    ] as never);
    prismaMock.chargeRegularization.findMany.mockResolvedValue([]);

    const result = await getTenantChargeDetail("soc-1", "building-1", 2024);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.[0]?.tenantName).toBe("SARL Immoval");
    }
  });
});