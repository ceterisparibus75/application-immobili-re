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

import { getChargeDashboardData } from "./charge-dashboard";

const mockBuildings = [
  { id: "b1", name: "Residence A", city: "Paris" },
  { id: "b2", name: "Residence B", city: "Lyon" },
];

const makeCharge = (buildingId: string, month: number, amount: number, categoryName: string) => ({
  id: `charge-${buildingId}-${month}`,
  buildingId,
  amount,
  date: new Date(2024, month - 1, 15),
  category: { name: categoryName },
});

describe("getChargeDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSocietyActionContext.mockResolvedValue({ userId: "user-1", societyId: "soc-1" });
  });

  it("retourne une erreur si non autorise", async () => {
    requireSocietyActionContext.mockRejectedValue(new Error("Non autorise"));
    const result = await getChargeDashboardData("soc-1", 2024);
    expect(result.success).toBe(false);
  });

  it("retourne une structure vide si aucun immeuble", async () => {
    prismaMock.building.findMany.mockResolvedValue([]);
    prismaMock.charge.findMany.mockResolvedValue([]);
    const result = await getChargeDashboardData("soc-1", 2024);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.buildings).toHaveLength(0);
      expect(result.data?.monthly).toHaveLength(12);
    }
  });

  it("retourne 12 mois de donnees avec les totaux par mois", async () => {
    prismaMock.building.findMany.mockResolvedValue(mockBuildings as never);
    prismaMock.charge.findMany.mockResolvedValue([
      makeCharge("b1", 1, 500, "Eau"),
      makeCharge("b1", 1, 300, "Ascenseur"),
      makeCharge("b1", 3, 200, "Eau"),
      makeCharge("b2", 1, 400, "Electricite"),
    ] as never);
    const result = await getChargeDashboardData("soc-1", 2024);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.monthly).toHaveLength(12);
      const jan = result.data?.monthly.find((m) => m.month === 1);
      expect(jan?.total).toBe(1200);
      const mar = result.data?.monthly.find((m) => m.month === 3);
      expect(mar?.total).toBe(200);
      const feb = result.data?.monthly.find((m) => m.month === 2);
      expect(feb?.total).toBe(0);
    }
  });

  it("retourne les totaux par immeuble", async () => {
    prismaMock.building.findMany.mockResolvedValue(mockBuildings as never);
    prismaMock.charge.findMany.mockResolvedValue([
      makeCharge("b1", 1, 500, "Eau"),
      makeCharge("b1", 2, 300, "Ascenseur"),
      makeCharge("b2", 1, 400, "Electricite"),
    ] as never);
    const result = await getChargeDashboardData("soc-1", 2024);
    expect(result.success).toBe(true);
    if (result.success) {
      const b1 = result.data?.buildings.find((b) => b.buildingId === "b1");
      expect(b1?.total).toBe(800);
      const b2 = result.data?.buildings.find((b) => b.buildingId === "b2");
      expect(b2?.total).toBe(400);
    }
  });

  it("retourne les top categories par immeuble", async () => {
    prismaMock.building.findMany.mockResolvedValue([mockBuildings[0]] as never);
    prismaMock.charge.findMany.mockResolvedValue([
      makeCharge("b1", 1, 500, "Eau"),
      makeCharge("b1", 2, 300, "Eau"),
      makeCharge("b1", 3, 200, "Ascenseur"),
    ] as never);
    const result = await getChargeDashboardData("soc-1", 2024);
    expect(result.success).toBe(true);
    if (result.success) {
      const b1 = result.data?.buildings.find((b) => b.buildingId === "b1");
      expect(b1?.topCategories[0]?.name).toBe("Eau");
      expect(b1?.topCategories[0]?.total).toBe(800);
    }
  });

  it("filtre par immeuble quand buildingId est fourni", async () => {
    prismaMock.building.findMany.mockResolvedValue([mockBuildings[0]] as never);
    prismaMock.charge.findMany.mockResolvedValue([
      makeCharge("b1", 1, 500, "Eau"),
    ] as never);
    await getChargeDashboardData("soc-1", 2024, "b1");
    expect(prismaMock.building.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "b1" }),
      })
    );
  });
});