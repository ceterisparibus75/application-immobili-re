import { ALL_CATEGORIES, type CashflowCategoryId } from "@/lib/cashflow-categories";

export type AccountingAccountFallback = {
  code: string;
  label: string;
  type: string;
};

export type CashflowAccountingMapping = AccountingAccountFallback & {
  category: CashflowCategoryId;
};

const CATEGORY_IDS = new Set<string>(ALL_CATEGORIES.map((category) => category.id));

export const CASHFLOW_ACCOUNTING_MAPPINGS: Record<CashflowCategoryId, AccountingAccountFallback> = {
  loyers: { code: "706100", label: "Loyers", type: "7" },
  charges_locatives: { code: "708100", label: "Charges locatives refacturées", type: "7" },
  regularisation: { code: "758000", label: "Produits divers de gestion courante", type: "7" },
  autres_revenus: { code: "758000", label: "Produits divers de gestion courante", type: "7" },
  depot_garantie: { code: "165000", label: "Dépôts et cautionnements reçus", type: "1" },
  cession_immeuble: { code: "775000", label: "Produits des cessions d'éléments d'actif", type: "7" },

  charges_copro: { code: "614000", label: "Charges locatives et de copropriété", type: "6" },
  assurance: { code: "616000", label: "Primes d'assurance", type: "6" },
  entretien_courant: { code: "615000", label: "Entretien et réparations", type: "6" },
  taxes: { code: "635000", label: "Autres impôts et taxes", type: "6" },
  frais_bancaires: { code: "627000", label: "Services bancaires et assimilés", type: "6" },
  interets_emprunt: { code: "661100", label: "Intérêts des emprunts", type: "6" },
  remboursement_emprunt: { code: "164000", label: "Emprunts auprès des établissements de crédit", type: "1" },
  honoraires: { code: "622000", label: "Rémunérations d'intermédiaires et honoraires", type: "6" },
  energie: { code: "606100", label: "Fournitures non stockables - eau, énergie", type: "6" },
  fournitures: { code: "606300", label: "Fournitures d'entretien et de petit équipement", type: "6" },
  frais_gestion: { code: "622000", label: "Rémunérations d'intermédiaires et honoraires", type: "6" },
  divers_depense: { code: "658000", label: "Charges diverses de gestion courante", type: "6" },
  travaux: { code: "615000", label: "Entretien et réparations", type: "6" },
  acquisition_immeuble: { code: "213000", label: "Constructions", type: "2" },

  virement_interne: { code: "580000", label: "Virements internes", type: "5" },
  apport_cca: { code: "455000", label: "Associés - comptes courants", type: "4" },
  remboursement_cca: { code: "455000", label: "Associés - comptes courants", type: "4" },
  souscription_emprunt: { code: "164000", label: "Emprunts auprès des établissements de crédit", type: "1" },
};

export function getAccountingFallbackForCashflowCategory(
  category: string | null | undefined
): AccountingAccountFallback | null {
  if (!category || !CATEGORY_IDS.has(category)) return null;
  return CASHFLOW_ACCOUNTING_MAPPINGS[category as CashflowCategoryId] ?? null;
}
