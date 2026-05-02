"use server";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/society";
import { requireSocietyActionContext, UnauthenticatedActionError } from "@/lib/action-society";
import { ForbiddenError } from "@/lib/permissions";

export type MonthlyTotal = { month: number; total: number };

export type CategoryTotal = { name: string; total: number };

export type BuildingDashboardRow = {
  buildingId: string;
  buildingName: string;
  buildingCity: string;
  total: number;
  topCategories: CategoryTotal[];
};

export type ChargeDashboardData = {
  year: number;
  monthly: MonthlyTotal[];
  buildings: BuildingDashboardRow[];
  grandTotal: number;
};

export async function getChargeDashboardData(
  societyId: string,
  year: number,
  buildingId?: string
): Promise<ActionResult<ChargeDashboardData>> {
  try {
    await requireSocietyActionContext(societyId, "LECTURE");

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const buildings = await prisma.building.findMany({
      where: { societyId, ...(buildingId ? { id: buildingId } : {}) },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });

    const charges = await prisma.charge.findMany({
      where: {
        societyId,
        ...(buildingId ? { buildingId } : {}),
        date: { gte: yearStart, lte: yearEnd },
      },
      select: { buildingId: true, amount: true, date: true, category: { select: { name: true } } },
    });

    const monthly: MonthlyTotal[] = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const total = charges
        .filter((c) => new Date(c.date).getMonth() + 1 === month)
        .reduce((s, c) => s + c.amount, 0);
      return { month, total: Math.round(total * 100) / 100 };
    });

    const buildingRows: BuildingDashboardRow[] = buildings.map((b) => {
      const bCharges = charges.filter((c) => c.buildingId === b.id);
      const total = Math.round(bCharges.reduce((s, c) => s + c.amount, 0) * 100) / 100;

      const catMap = new Map<string, number>();
      for (const c of bCharges) {
        catMap.set(c.category.name, (catMap.get(c.category.name) ?? 0) + c.amount);
      }
      const topCategories: CategoryTotal[] = Array.from(catMap.entries())
        .map(([name, catTotal]) => ({ name, total: Math.round(catTotal * 100) / 100 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      return { buildingId: b.id, buildingName: b.name, buildingCity: b.city ?? "", total, topCategories };
    });

    const grandTotal = Math.round(buildingRows.reduce((s, r) => s + r.total, 0) * 100) / 100;

    return { success: true, data: { year, monthly, buildings: buildingRows, grandTotal } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getChargeDashboardData]", error);
    return { success: false, error: "Erreur lors du chargement du tableau de bord" };
  }
}