// Helpers de calcul + types — pas de "use server".

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ChargePeriodLike = {
  amount: number;
  date: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
};

export type ChargeProvisionLike = {
  monthlyAmount: number;
  startDate: Date;
  endDate?: Date | null;
};

export type AllocationCategoryLike = {
  allocationMethod: string;
  allocationKeys?: Array<{
    entries: Array<{ lotId: string; percentage: number }>;
  }>;
};

export type AllocationLeaseLike = {
  lotId?: string | null;
  lot: {
    id?: string;
    area: number;
    commonShares?: number | null;
  };
};

export type ChargeNatureLike = "PROPRIETAIRE" | "RECUPERABLE" | "MIXTE" | string;

export function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function inclusiveDays(start: Date, end: Date): number {
  const startTime = dayStart(start).getTime();
  const endTime = dayStart(end).getTime();
  return Math.max(0, Math.floor((endTime - startTime) / MS_PER_DAY) + 1);
}

export function dateOnlyIso(date: Date): string {
  const normalized = dayStart(date);
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");
  return `${normalized.getFullYear()}-${month}-${day}`;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function overlapDays(startA: Date, endA: Date, startB: Date, endB: Date): number {
  const start = new Date(Math.max(dayStart(startA).getTime(), dayStart(startB).getTime()));
  const end = new Date(Math.min(dayStart(endA).getTime(), dayStart(endB).getTime()));
  return inclusiveDays(start, end);
}

export function inclusiveMonths(start: Date, end: Date): number {
  if (dayStart(end) < dayStart(start)) return 0;
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
}

export function chargeAmountForPeriod(charge: ChargePeriodLike, periodStart: Date, periodEnd: Date): number {
  const chargeStart = charge.periodStart ?? charge.date;
  const chargeEnd = charge.periodEnd ?? charge.date;
  const totalDays = inclusiveDays(chargeStart, chargeEnd);
  if (totalDays === 0) return 0;

  const coveredDays = overlapDays(chargeStart, chargeEnd, periodStart, periodEnd);
  return charge.amount * (coveredDays / totalDays);
}

export function provisionAmountForPeriod(provision: ChargeProvisionLike, periodStart: Date, periodEnd: Date): number {
  const start = new Date(Math.max(dayStart(provision.startDate).getTime(), dayStart(periodStart).getTime()));
  const rawEnd = provision.endDate ?? periodEnd;
  const end = new Date(Math.min(dayStart(rawEnd).getTime(), dayStart(periodEnd).getTime()));
  return provision.monthlyAmount * inclusiveMonths(start, end);
}

export function recoverableRateFor(nature: ChargeNatureLike, recoverableRate?: number | null): number {
  if (nature === "PROPRIETAIRE") return 0;
  if (nature === "RECUPERABLE") return 1;
  return (recoverableRate ?? 50) / 100;
}

export function allocationRateForCategory(
  category: AllocationCategoryLike,
  lease: AllocationLeaseLike,
  totals: { totalTantiemes: number; totalSurface: number; nbLots: number }
): number {
  if ((category.allocationMethod === "PERSONNALISE" || category.allocationMethod === "COMPTEUR") && (category.allocationKeys?.length ?? 0) > 0) {
    const key = category.allocationKeys![0]!;
    const lotId = lease.lotId ?? lease.lot.id;
    const entry = key.entries.find((e) => e.lotId === lotId);
    return entry ? entry.percentage / 100 : 0;
  }

  if (category.allocationMethod === "SURFACE" && totals.totalSurface > 0) {
    return lease.lot.area / totals.totalSurface;
  }

  if (category.allocationMethod === "NB_LOTS" && totals.nbLots > 0) {
    return 1 / totals.nbLots;
  }

  if (totals.totalTantiemes > 0 && (lease.lot.commonShares ?? 0) > 0) {
    return (lease.lot.commonShares ?? 0) / totals.totalTantiemes;
  }

  if (totals.totalSurface > 0) {
    return lease.lot.area / totals.totalSurface;
  }

  return totals.nbLots > 0 ? 1 / totals.nbLots : 0;
}

// ─── Catégories de charges ────────────────────────────────────────────────────
