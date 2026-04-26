export type TenantNameParts = {
  entityType: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type RiskItem = { name: string; annualRent: number; pct: number };

export const RENT_FREQUENCY_MULTIPLIER: Record<string, number> = {
  MENSUEL: 12,
  TRIMESTRIEL: 4,
  SEMESTRIEL: 2,
  ANNUEL: 1,
};

export function displayTenantName(t: TenantNameParts): string {
  if (t.entityType === "PERSONNE_MORALE") return t.companyName ?? "—";
  return `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

/** Normalise un nom de locataire pour regrouper les variantes (casse, accents, espaces). */
export function normalizeTenantKey(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

export function truncateBuildingName(name: string): string {
  return name.length > 22 ? `${name.slice(0, 20)}…` : name;
}

export function calculateRevenueChange(currentMonthRevenue: number, prevMonthRevenue: number): number {
  if (prevMonthRevenue > 0) {
    return Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
  }
  return currentMonthRevenue > 0 ? 100 : 0;
}

export function annualizeRent(currentRentHT: number, paymentFrequency: string): number {
  return currentRentHT * (RENT_FREQUENCY_MULTIPLIER[paymentFrequency] ?? 12);
}

export function toRiskItems(
  rents: Map<string, number>,
  totalAnnualRent: number,
  displayMap?: Map<string, string>
): RiskItem[] {
  return [...rents.entries()]
    .map(([key, annualRent]) => ({
      name: displayMap?.get(key) ?? key,
      annualRent,
      pct: totalAnnualRent > 0 ? Math.round((annualRent / totalAnnualRent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);
}

/** Indice Herfindahl-Hirschman (0 = diversifié, 10000 = concentré). */
export function calculateHhi(items: Array<{ pct: number }>): number {
  return Math.round(items.reduce((sum, item) => sum + item.pct * item.pct, 0));
}
