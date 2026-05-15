/**
 * Mapping des catégories cash-flow (`src/lib/cashflow-categories.ts`) vers
 * les imputations utilisées par le moteur de démembrement
 * (`src/lib/ownership.ts`). Sert au tagging automatique du bénéficiaire
 * effectif des flux bancaires sur un lot démembré.
 *
 * Les neutres (virement interne, CCA, souscription emprunt) ne sont pas
 * mappées : elles n'affectent ni l'usufruitier ni le nu-propriétaire.
 *
 * Pour les cas ambigus, on retient la règle civile la plus fréquente :
 * - intérêts d'emprunt → charge courante (usufruitier) par convention usuelle,
 *   mais peut être renégocié si l'usufruit est récent (à overrider via convention).
 * - dépôt de garantie → considéré comme un revenu de gestion : encaissé par
 *   l'usufruitier, qui devra le restituer en fin de bail.
 */

import type { CashflowImputation } from "@/lib/ownership";

type CashflowCategoryToImputation = Readonly<Record<string, CashflowImputation>>;

const EXPENSE_MAP: CashflowCategoryToImputation = {
  charges_copro: "CHARGE_COURANTE",
  assurance: "ASSURANCE",
  entretien_courant: "CHARGE_COURANTE",
  taxes: "TAXE_FONCIERE",
  frais_bancaires: "CHARGE_COURANTE",
  interets_emprunt: "CHARGE_COURANTE",
  remboursement_emprunt: "ACQUISITION", // capital → patrimoine du nu-propriétaire
  honoraires: "HONORAIRES_GESTION",
  energie: "CHARGE_COURANTE",
  fournitures: "CHARGE_COURANTE",
  frais_gestion: "HONORAIRES_GESTION",
  divers_depense: "CHARGE_COURANTE",
  travaux: "GROS_TRAVAUX",
  acquisition_immeuble: "ACQUISITION",
} as const;

const INCOME_MAP: CashflowCategoryToImputation = {
  loyers: "REVENU",
  charges_locatives: "CHARGE_COURANTE",
  regularisation: "CHARGE_COURANTE",
  autres_revenus: "REVENU",
  cession_immeuble: "ACQUISITION",
  depot_garantie: "REVENU",
} as const;

const NEUTRAL_IDS = new Set<string>([
  "virement_interne",
  "apport_cca",
  "remboursement_cca",
  "souscription_emprunt",
]);

/**
 * Renvoie l'imputation usufruit/nue-propriété correspondant à une catégorie
 * cash-flow, ou `null` si la catégorie est neutre / inconnue.
 */
export function imputationForCategory(categoryId: string): CashflowImputation | null {
  if (NEUTRAL_IDS.has(categoryId)) return null;
  return EXPENSE_MAP[categoryId] ?? INCOME_MAP[categoryId] ?? null;
}

/** Liste des catégories qui sont à la charge du nu-propriétaire par défaut. */
export function isNuProprietaireDefault(categoryId: string): boolean {
  const imputation = imputationForCategory(categoryId);
  return (
    imputation === "GROS_TRAVAUX" ||
    imputation === "ACQUISITION" ||
    imputation === "INDEMNITE_ASSURANCE_CAPITAL"
  );
}

/** Liste des catégories à la charge / au bénéfice de l'usufruitier par défaut. */
export function isUsufruitierDefault(categoryId: string): boolean {
  const imputation = imputationForCategory(categoryId);
  if (imputation === null) return false;
  return !isNuProprietaireDefault(categoryId);
}
