const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ChargeReportCategoryPresentation = {
  categoryName: string;
  nature: string;
  totalAmount: number;
  recoverableAmount: number;
  allocationMethod: string;
  allocationRate: number;
  tenantShare: number;
};

export type ChargeReportPresentation = {
  occupancyStart: Date | null;
  occupancyEnd: Date | null;
  hasPartialOccupancy: boolean;
  prorataDays: number | null;
  allocatedCharges: number | null;
  categories: ChargeReportCategoryPresentation[];
};

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function inclusiveDays(start: Date, end: Date): number {
  const startTime = dayStart(start).getTime();
  const endTime = dayStart(end).getTime();
  return Math.max(0, Math.floor((endTime - startTime) / MS_PER_DAY) + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function dateValue(value: unknown): Date | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function normalizeCategory(raw: unknown): ChargeReportCategoryPresentation | null {
  if (!isRecord(raw)) return null;

  const categoryName = stringValue(raw.categoryName) ?? stringValue(raw.label) ?? "Catégorie";
  const nature = stringValue(raw.nature) ?? "RECUPERABLE";
  const totalAmount = numberValue(raw.totalAmount) ?? numberValue(raw.amount) ?? 0;
  const legacyRecoverable = numberValue(raw.recoverable);
  const recoverableAmount = numberValue(raw.recoverableAmount) ?? legacyRecoverable ?? totalAmount;
  const tenantShare = numberValue(raw.tenantShare) ?? legacyRecoverable ?? recoverableAmount;

  return {
    categoryName,
    nature,
    totalAmount: roundMoney(totalAmount),
    recoverableAmount: roundMoney(recoverableAmount),
    allocationMethod: stringValue(raw.allocationMethod) ?? "-",
    allocationRate: roundMoney(numberValue(raw.allocationRate) ?? 0),
    tenantShare: roundMoney(tenantShare),
  };
}

export function buildChargeReportPresentation(
  details: unknown,
  periodStart: Date,
  periodEnd: Date
): ChargeReportPresentation {
  if (!isRecord(details)) {
    return {
      occupancyStart: null,
      occupancyEnd: null,
      hasPartialOccupancy: false,
      prorataDays: null,
      allocatedCharges: null,
      categories: [],
    };
  }

  const categories = Array.isArray(details.categories)
    ? details.categories.map(normalizeCategory).filter((cat): cat is ChargeReportCategoryPresentation => cat !== null)
    : [];
  const occupancyStart = dateValue(details.occupancyStart);
  const occupancyEnd = dateValue(details.occupancyEnd);
  const prorataDays = numberValue(details.prorataDays);
  const fullPeriodDays = inclusiveDays(periodStart, periodEnd);
  const hasExplicitPartialPeriod =
    occupancyStart !== null &&
    occupancyEnd !== null &&
    (dayStart(occupancyStart).getTime() !== dayStart(periodStart).getTime() ||
      dayStart(occupancyEnd).getTime() !== dayStart(periodEnd).getTime());
  const hasPartialOccupancy = hasExplicitPartialPeriod || (prorataDays !== null && prorataDays > 0 && prorataDays < fullPeriodDays);
  const allocatedCharges = numberValue(details.totalRecoverableAllocated) ?? (
    categories.length > 0 ? roundMoney(categories.reduce((sum, category) => sum + category.tenantShare, 0)) : null
  );

  return {
    occupancyStart,
    occupancyEnd,
    hasPartialOccupancy,
    prorataDays,
    allocatedCharges: allocatedCharges !== null ? roundMoney(allocatedCharges) : null,
    categories,
  };
}
