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

import { getChargeBudgetSummary } from "./charge-budget";

const mockBuildings = [
  { id: "building-1", name: "Residence A", city: "Paris" },
  { id: "building-2", name: "Residence B", city: "Lyon" },
];

const mockCharges = [
  { id: "c1", buildingId: "building-1", amount: 500, date: new Date("2024-03-15") },
  { id: "c2", buildingId: "building-1", amount: 300, date: new Date("2024-07-20") },
  { id: "c3", buildingId: "building-2", amount: 200, date: new Date("2024-05-10") },
];

const mockLeases = [
  {
    id: "lease-1",
    lot: { building: { id: "building-1", name: "Residence A", city: "Paris" } },
    chargeProvisions: [
      { monthlyAmount: 100, startDate: new Date("2024-01-01"), endDate: null, isActive: true },
    ],
  },
  {
    id: "lease-2",
    lot: { building: { id: "building-1", name: "Residence A", city: "Paris" } },
    chargeProvisions: [
      { monthlyAmount: 50, startDate: new Date("2024-01-01"), endDate: null, isActive: true },
    ],
  },
  {
    id: "lease-3",
    lot: { building: { id: "building-2", name: "Residence B", city: "Lyon" } },
    chargeProvisions: [
      { monthlyAmount: 80, startDate: new Date("2024-01-01"), endDate: null, isActive: true },
    ],
  },
];

describe("getChargeBudgetSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSocietyActionContext.mockResolvedValue({ userId: "user-1" });
    prismaMock.building.findMany.mockResolvedValue(mockBuildings as never);
    prismaMock.charge.findMany.mockResolvedValue(mockCharges as never);
    prismaMock.lease.findMany.mockResolvedValue(mockLeases as never);
  });

  it("retourne une erreur si l'auth echoue", async () => {
    requireSocietyActionContext.mockRejectedValue(new Error("Acces refuse"));
    const result = await getChargeBudgetSummary("soc-1", 2024);
    expect(result.success).toBe(false);
  });

  it("retourne un tableau vide si aucun immeuble", async () => {
    prismaMock.building.findMany.mockResolvedValue([]);
    const result = await getChargeBudgetSummary("soc-1", 2024);
    expect(result.success).toBe(true);
    expect(result.data?.buildings).toHaveLength(0);
  });

  it("calcule les charges reelles par immeuble", async () => {
    const result = await getChargeBudgetSummary("soc-1", 2024);
    expect(result.success).toBe(true);
    const b1 = result.data?.buildings.find((b) => b.buildingId === "building-1");
    expect(b1?.actualCharges).toBe(800); // 500 + 300
    const b2 = result.data?.buildings.find((b) => b.buildingId === "building-2");
    expect(b2?.actualCharges).toBe(200);
  });

  it("calcule les provisions par immeuble pour l'annee", async () => {
    const result = await getChargeBudgetSummary("soc-1", 2024);
    const b1 = result.data?.buildings.find((b) => b.buildingId === "building-1");
    // Lease-1: 100/mois * 12 + Lease-2: 50/mois * 12 = 1200 + 600 = 1800
    expect(b1?.totalProvisions).toBe(1800);
  });

  it("calcule le solde (ecart provisions - charges reelles)", async () => {
    const result = await getChargeBudgetSummary("soc-1", 2024);
    const b1 = result.data?.buildings.find((b) => b.buildingId === "building-1");
    // 1800 provisions - 800 charges = +1000 (excedent)
    expect(b1?.balance).toBe(1000);
  });

  it("retourne les totaux globaux", async () => {
    const result = await getChargeBudgetSummary("soc-1", 2024);
    expect(result.data?.totals.actualCharges).toBe(1000); // 800 + 200
    expect(result.data?.totals.totalProvisions).toBe(2760); // 1800 + 960
  });
});