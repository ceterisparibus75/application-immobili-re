/**
 * Catégories de ventilation pour le module Cash-flow.
 * Utilisées côté serveur (actions) et côté client (UI).
 */

// ── Catégories de dépenses ──────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  { id: "charges_copro", label: "Charges de copropriété", color: "#8B5CF6" },
  { id: "assurance", label: "Assurances", color: "#EC4899" },
  { id: "travaux", label: "Travaux & maintenance", color: "#F59E0B" },
  { id: "taxes", label: "Taxes & impôts", color: "#EF4444" },
  { id: "frais_bancaires", label: "Frais bancaires", color: "#6366F1" },
  { id: "interets_emprunt", label: "Intérêts d'emprunt", color: "#14B8A6" },
  { id: "remboursement_emprunt", label: "Remboursement d'emprunt", color: "#0EA5E9" },
  { id: "honoraires", label: "Honoraires professionnels", color: "#F97316" },
  { id: "energie", label: "Énergie & fluides", color: "#06B6D4" },
  { id: "fournitures", label: "Fournitures & équipement", color: "#84CC16" },
  { id: "frais_gestion", label: "Frais de gestion", color: "#A855F7" },
  { id: "divers_depense", label: "Divers / Non catégorisé", color: "#94A3B8" },
] as const;

// ── Catégories de revenus ───────────────────────────────────────────────────

export const INCOME_CATEGORIES = [
  { id: "loyers", label: "Loyers", color: "#22C55E" },
  { id: "charges_locatives", label: "Charges locatives", color: "#10B981" },
  { id: "depot_garantie", label: "Dépôts de garantie", color: "#34D399" },
  { id: "regularisation", label: "Régularisations", color: "#6EE7B7" },
  { id: "autres_revenus", label: "Autres revenus", color: "#A7F3D0" },
] as const;

// ── Catégories neutres (exclues du cash flow) ───────────────────────────────

export const NEUTRAL_CATEGORIES = [
  { id: "virement_interne", label: "Virement de compte à compte", color: "#64748B" },
] as const;

// ── Tous les catégories ─────────────────────────────────────────────────────

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...NEUTRAL_CATEGORIES];

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];
export type IncomeCategoryId = (typeof INCOME_CATEGORIES)[number]["id"];
export type NeutralCategoryId = (typeof NEUTRAL_CATEGORIES)[number]["id"];
export type CashflowCategoryId = ExpenseCategoryId | IncomeCategoryId | NeutralCategoryId;

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getCategoryLabel(id: string): string {
  const cat = ALL_CATEGORIES.find((c) => c.id === id);
  return cat?.label ?? id;
}

export function getCategoryColor(id: string): string {
  const cat = ALL_CATEGORIES.find((c) => c.id === id);
  return cat?.color ?? "#94A3B8";
}

export function isExpenseCategory(id: string): boolean {
  return EXPENSE_CATEGORIES.some((c) => c.id === id);
}

export function isIncomeCategory(id: string): boolean {
  return INCOME_CATEGORIES.some((c) => c.id === id);
}

export function isNeutralCategory(id: string): boolean {
  return NEUTRAL_CATEGORIES.some((c) => c.id === id);
}
