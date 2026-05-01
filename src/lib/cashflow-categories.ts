/**
 * Catégories de ventilation pour le module Cash-flow.
 * Utilisées côté serveur (actions) et côté client (UI).
 *
 * recurring: true  → flux opérationnel courant (récurrent)
 * recurring: false → flux exceptionnel ou de financement (ponctuel)
 */

// ── Catégories de dépenses ──────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  // Opérationnel (récurrent)
  { id: "charges_copro",       label: "Charges de copropriété",       color: "#8B5CF6", recurring: true  },
  { id: "assurance",           label: "Assurances",                   color: "#EC4899", recurring: true  },
  { id: "entretien_courant",   label: "Entretien & menus travaux",    color: "#65A30D", recurring: true  },
  { id: "taxes",               label: "Taxes & impôts",               color: "#EF4444", recurring: true  },
  { id: "frais_bancaires",     label: "Frais bancaires",              color: "#6366F1", recurring: true  },
  { id: "interets_emprunt",    label: "Intérêts d'emprunt",           color: "#14B8A6", recurring: true  },
  { id: "remboursement_emprunt", label: "Remboursement d'emprunt",    color: "#0EA5E9", recurring: true  },
  { id: "honoraires",          label: "Honoraires professionnels",    color: "#F97316", recurring: true  },
  { id: "energie",             label: "Énergie & fluides",            color: "#06B6D4", recurring: true  },
  { id: "fournitures",         label: "Fournitures & équipement",     color: "#84CC16", recurring: true  },
  { id: "frais_gestion",       label: "Frais de gestion",             color: "#A855F7", recurring: true  },
  { id: "divers_depense",      label: "Divers / Non catégorisé",      color: "#94A3B8", recurring: true  },
  // Exceptionnel (non-récurrent)
  { id: "travaux",             label: "Travaux & rénovation",         color: "#F59E0B", recurring: false },
  { id: "acquisition_immeuble", label: "Acquisition immobilière",     color: "#DC2626", recurring: false },
] as const;

// ── Catégories de revenus ───────────────────────────────────────────────────

export const INCOME_CATEGORIES = [
  // Opérationnel (récurrent)
  { id: "loyers",              label: "Loyers",                       color: "#22C55E", recurring: true  },
  { id: "charges_locatives",   label: "Charges locatives récupérées", color: "#10B981", recurring: true  },
  { id: "regularisation",      label: "Régularisations",              color: "#6EE7B7", recurring: true  },
  { id: "autres_revenus",      label: "Autres revenus",               color: "#A7F3D0", recurring: true  },
  // Exceptionnel (non-récurrent)
  { id: "cession_immeuble",    label: "Cession immobilière",          color: "#2563EB", recurring: false },
  { id: "depot_garantie",      label: "Dépôts de garantie",           color: "#34D399", recurring: false },
] as const;

// ── Catégories neutres ──────────────────────────────────────────────────────
// virement_interne : exclu du cash-flow (doublon comptable)
// apport_cca / remboursement_cca : flux de financement — affichés dans section dédiée

export const NEUTRAL_CATEGORIES = [
  { id: "virement_interne",    label: "Virement de compte à compte",                  color: "#64748B", recurring: false },
  { id: "apport_cca",          label: "Apport en compte courant d'associés",          color: "#78716C", recurring: false },
  { id: "remboursement_cca",   label: "Remboursement de compte courant d'associés",   color: "#57534E", recurring: false },
] as const;

// ── Tous les catégories ─────────────────────────────────────────────────────

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...NEUTRAL_CATEGORIES];

export type ExpenseCategoryId   = (typeof EXPENSE_CATEGORIES)[number]["id"];
export type IncomeCategoryId    = (typeof INCOME_CATEGORIES)[number]["id"];
export type NeutralCategoryId   = (typeof NEUTRAL_CATEGORIES)[number]["id"];
export type CashflowCategoryId  = ExpenseCategoryId | IncomeCategoryId | NeutralCategoryId;

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getCategoryLabel(id: string): string {
  return ALL_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function getCategoryColor(id: string): string {
  return ALL_CATEGORIES.find((c) => c.id === id)?.color ?? "#94A3B8";
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

/** Flux récurrent (opérationnel courant). */
export function isRecurringCategory(id: string): boolean {
  const cat = ALL_CATEGORIES.find((c) => c.id === id);
  return (cat as { recurring?: boolean } | undefined)?.recurring === true;
}

/** Flux de financement : CCA uniquement (exclu du cash-flow opérationnel). */
export function isFinancementCategory(id: string): boolean {
  return id === "apport_cca" || id === "remboursement_cca";
}

/** Virement interne strict (doublon comptable, exclu de tout calcul). */
export function isVirementInterne(id: string): boolean {
  return id === "virement_interne";
}