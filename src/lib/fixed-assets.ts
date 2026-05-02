export type DepreciationScheduleInput = {
  depreciableBase: number;
  residualValue?: number;
  serviceStartDate: Date;
  durationMonths: number;
};

export type DepreciationScheduleLine = {
  fiscalYear: number;
  periodStart: Date;
  periodEnd: Date;
  amount: number;
  accumulatedAmount: number;
  netBookValue: number;
};

export type FixedAssetCategoryPreset = {
  label: string;
  defaultDurationMonths: number;
  assetAccountPrefix: string;
  depreciationAccountPrefix: string;
};

export const REAL_ESTATE_FIXED_ASSET_PRESETS: Record<string, FixedAssetCategoryPreset> = {
  STRUCTURE: {
    label: "Structure / gros oeuvre",
    defaultDurationMonths: 600,
    assetAccountPrefix: "2131",
    depreciationAccountPrefix: "28131",
  },
  FACADE_TOITURE: {
    label: "Façade, toiture, clos et couvert",
    defaultDurationMonths: 300,
    assetAccountPrefix: "2131",
    depreciationAccountPrefix: "28131",
  },
  INSTALLATIONS_TECHNIQUES: {
    label: "Installations techniques",
    defaultDurationMonths: 180,
    assetAccountPrefix: "2132",
    depreciationAccountPrefix: "28132",
  },
  AGENCEMENTS_AMENAGEMENTS: {
    label: "Agencements et aménagements",
    defaultDurationMonths: 120,
    assetAccountPrefix: "2132",
    depreciationAccountPrefix: "28132",
  },
  MOBILIER_EQUIPEMENTS: {
    label: "Mobilier et équipements",
    defaultDurationMonths: 84,
    assetAccountPrefix: "218",
    depreciationAccountPrefix: "2818",
  },
  TRAVAUX_COPROPRIETE: {
    label: "Travaux de copropriété immobilisés",
    defaultDurationMonths: 180,
    assetAccountPrefix: "2132",
    depreciationAccountPrefix: "28132",
  },
  AUTRE: {
    label: "Autre immobilisation",
    defaultDurationMonths: 120,
    assetAccountPrefix: "2",
    depreciationAccountPrefix: "28",
  },
};

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function buildLinearDepreciationSchedule(input: DepreciationScheduleInput): DepreciationScheduleLine[] {
  const residualValue = input.residualValue ?? 0;
  const totalDepreciable = roundCents(input.depreciableBase - residualValue);
  if (totalDepreciable <= 0) return [];
  if (input.durationMonths <= 0) return [];

  const serviceStartMonth = startOfMonth(input.serviceStartDate);
  const monthlyRaw = totalDepreciable / input.durationMonths;
  const byYear = new Map<number, { periodStart: Date; periodEnd: Date; amount: number }>();

  for (let index = 0; index < input.durationMonths; index += 1) {
    const monthStart = addMonths(serviceStartMonth, index);
    const year = monthStart.getUTCFullYear();
    const current = byYear.get(year);
    const periodStart = index === 0 ? new Date(input.serviceStartDate) : monthStart;
    const periodEnd = endOfMonth(monthStart);
    const amount = index === input.durationMonths - 1
      ? totalDepreciable - roundCents(monthlyRaw) * (input.durationMonths - 1)
      : roundCents(monthlyRaw);

    if (current) {
      current.periodEnd = periodEnd;
      current.amount += amount;
    } else {
      byYear.set(year, { periodStart, periodEnd, amount });
    }
  }

  let accumulated = 0;
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([fiscalYear, line], index, lines) => {
      const isLast = index === lines.length - 1;
      const amount = isLast ? roundCents(totalDepreciable - accumulated) : roundCents(line.amount);
      accumulated = roundCents(accumulated + amount);
      return {
        fiscalYear,
        periodStart: line.periodStart,
        periodEnd: line.periodEnd,
        amount,
        accumulatedAmount: accumulated,
        netBookValue: roundCents(input.depreciableBase - accumulated),
      };
    });
}
