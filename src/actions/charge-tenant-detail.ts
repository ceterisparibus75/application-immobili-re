"use server";

import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/society";
import { requireSocietyActionContext, UnauthenticatedActionError } from "@/lib/action-society";
import { ForbiddenError } from "@/lib/permissions";

export type TenantChargeRow = {
  leaseId: string;
  tenantName: string;
  lotNumber: string;
  totalProvisions: number;
  totalChargesAllocated: number;
  balance: number;
  hasRegularization: boolean;
  regularizationIsFinalized: boolean;
};

function calcProvisionMonths(
  provision: { monthlyAmount: number; startDate: Date; endDate: Date | null },
  year: number
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const start = provision.startDate > yearStart ? provision.startDate : yearStart;
  const end = provision.endDate
    ? provision.endDate < yearEnd ? provision.endDate : yearEnd
    : yearEnd;
  if (end < start) return 0;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() - start.getMonth() + 1;
  return Math.max(0, months);
}

export async function getTenantChargeDetail(
  societyId: string,
  buildingId: string,
  year: number
): Promise<ActionResult<TenantChargeRow[]>> {
  try {
    await requireSocietyActionContext(societyId, "LECTURE");

    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const [leases, regularizations] = await Promise.all([
      prisma.lease.findMany({
        where: {
          societyId,
          lot: { buildingId },
          startDate: { lte: yearEnd },
          status: { in: ["EN_COURS", "RESILIE", "RENOUVELE"] },
        },
        select: {
          id: true,
          tenantId: true,
          tenant: {
            select: { id: true, entityType: true, firstName: true, lastName: true, companyName: true },
          },
          lot: { select: { number: true } },
          chargeProvisions: {
            where: { isActive: true },
            select: { monthlyAmount: true, startDate: true, endDate: true },
          },
        },
        orderBy: { lot: { number: "asc" } },
      }),
      prisma.chargeRegularization.findMany({
        where: { societyId, fiscalYear: year },
        select: {
          leaseId: true,
          fiscalYear: true,
          totalCharges: true,
          totalProvisions: true,
          balance: true,
          isFinalized: true,
        },
      }),
    ]);

    const regByLease = new Map(regularizations.map((r) => [r.leaseId, r]));

    const rows: TenantChargeRow[] = leases.map((lease) => {
      const tenantName =
        lease.tenant.entityType === "PERSONNE_MORALE"
          ? (lease.tenant.companyName ?? "—")
          : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";

      const totalProvisions = Math.round(
        lease.chargeProvisions.reduce((s, p) => {
          const months = calcProvisionMonths(p, year);
          return s + p.monthlyAmount * months;
        }, 0) * 100
      ) / 100;

      const reg = regByLease.get(lease.id);

      return {
        leaseId: lease.id,
        tenantName,
        lotNumber: lease.lot.number,
        totalProvisions,
        totalChargesAllocated: reg ? reg.totalCharges : 0,
        balance: reg ? reg.balance : 0,
        hasRegularization: !!reg,
        regularizationIsFinalized: reg ? reg.isFinalized : false,
      };
    });

    return { success: true, data: rows };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getTenantChargeDetail]", error);
    return { success: false, error: "Erreur lors du chargement du détail locataires" };
  }
}