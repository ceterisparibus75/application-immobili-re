"use server";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/society";
import { requireSocietyActionContext, UnauthenticatedActionError } from "@/lib/action-society";
import { ForbiddenError } from "@/lib/permissions";

export type BuildingBudgetRow = {
  buildingId: string;
  buildingName: string;
  buildingCity: string;
  totalProvisions: number;
  actualCharges: number;
  balance: number;
};

export type ChargeBudgetSummaryData = {
  year: number;
  buildings: BuildingBudgetRow[];
  totals: { totalProvisions: number; actualCharges: number; balance: number };
};

function calcProvisionMonths(
  provision: { monthlyAmount: number; startDate: Date; endDate: Date | null },
  year: number
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const start = provision.startDate > yearStart ? provision.startDate : yearStart;
  const end = provision.endDate
    ? provision.endDate < yearEnd
      ? provision.endDate
      : yearEnd
    : yearEnd;
  if (end < start) return 0;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth() +
    1;
  return Math.max(0, months);
}

export async function getChargeBudgetSummary(
  societyId: string,
  year: number,
  buildingId?: string
): Promise<ActionResult<ChargeBudgetSummaryData>> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const buildings = await prisma.building.findMany({
      where: { societyId, ...(buildingId ? { id: buildingId } : {}) },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });

    if (buildings.length === 0) {
      return { success: true, data: { year, buildings: [], totals: { totalProvisions: 0, actualCharges: 0, balance: 0 } } };
    }

    const buildingIds = buildings.map((b) => b.id);

    const [charges, leases] = await Promise.all([
      prisma.charge.findMany({
        where: {
          societyId,
          buildingId: { in: buildingIds },
          date: { gte: yearStart, lte: yearEnd },
        },
        select: { buildingId: true, amount: true },
      }),
      prisma.lease.findMany({
        where: {
          societyId,
          lot: { buildingId: { in: buildingIds } },
          startDate: { lte: yearEnd },
          status: { in: ["EN_COURS", "RESILIE", "RENOUVELE"] },
        },
        include: {
          lot: { include: { building: { select: { id: true, name: true, city: true } } } },
          chargeProvisions: {
            where: { isActive: true },
            select: { monthlyAmount: true, startDate: true, endDate: true },
          },
        },
      }),
    ]);

    const rows: BuildingBudgetRow[] = buildings.map((b) => {
      const buildingCharges = charges.filter((c) => c.buildingId === b.id);
      const actualCharges = Math.round(
        buildingCharges.reduce((s, c) => s + c.amount, 0) * 100
      ) / 100;

      const buildingLeases = leases.filter((l) => l.lot.building.id === b.id);
      const totalProvisions = Math.round(
        buildingLeases.reduce((sum, lease) => {
          const leaseProvisions = lease.chargeProvisions.reduce((s, p) => {
            const months = calcProvisionMonths(p, year);
            return s + p.monthlyAmount * months;
          }, 0);
          return sum + leaseProvisions;
        }, 0) * 100
      ) / 100;

      return {
        buildingId: b.id,
        buildingName: b.name,
        buildingCity: b.city ?? "",
        totalProvisions,
        actualCharges,
        balance: Math.round((totalProvisions - actualCharges) * 100) / 100,
      };
    });

    const totals = {
      totalProvisions: Math.round(rows.reduce((s, r) => s + r.totalProvisions, 0) * 100) / 100,
      actualCharges: Math.round(rows.reduce((s, r) => s + r.actualCharges, 0) * 100) / 100,
      balance: Math.round(rows.reduce((s, r) => s + r.balance, 0) * 100) / 100,
    };

    return { success: true, data: { year, buildings: rows, totals } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getChargeBudgetSummary]", error);
    return { success: false, error: "Erreur lors du calcul du budget" };
  }
}