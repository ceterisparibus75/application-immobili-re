// Templates d'écritures comptables récurrentes.
//
// Helpers purs — pas de "use server". Importé par le formulaire client
// `/comptabilite/nouvelle-ecriture` pour pré-remplir les lignes à partir d'un
// montant TTC et des ratios du modèle choisi.
//
// Les 4 modèles ci-dessous sont figés : si l'utilisateur veut gérer ses propres
// modèles, on introduira plus tard une table `JournalEntryTemplate` scopée par
// société. Pour l'instant, aucune table BDD n'est nécessaire.

import type { CanonicalAccountingJournalType } from "@/lib/accounting-journals";

export type JournalEntryTemplateLine = {
  /** Code PCG à matcher sur `AccountingAccount.code` (ex. "411000"). */
  accountCode: string;
  /** Libellé par défaut proposé pour la ligne. */
  label: string;
  /** Fraction du montant TTC à placer au débit (0 ≤ ratio ≤ 1). */
  debitRatio: number;
  /** Fraction du montant TTC à placer au crédit (0 ≤ ratio ≤ 1). */
  creditRatio: number;
};

export type JournalEntryTemplate = {
  id: string;
  label: string;
  journalType: CanonicalAccountingJournalType;
  lines: JournalEntryTemplateLine[];
};

export const JOURNAL_ENTRY_TEMPLATES: readonly JournalEntryTemplate[] = [
  {
    id: "RENT_MONTHLY_VT",
    label: "Loyer mensuel (encaissement)",
    journalType: "VT",
    lines: [
      { accountCode: "411000", label: "Locataire", debitRatio: 1, creditRatio: 0 },
      { accountCode: "706100", label: "Loyer HT", debitRatio: 0, creditRatio: 0.8333 },
      { accountCode: "445710", label: "TVA collectée 20%", debitRatio: 0, creditRatio: 0.1667 },
    ],
  },
  {
    id: "SUPPLIER_INVOICE_AC",
    label: "Facture fournisseur",
    journalType: "AC",
    lines: [
      { accountCode: "606100", label: "Fournitures", debitRatio: 0.8333, creditRatio: 0 },
      { accountCode: "445660", label: "TVA déductible 20%", debitRatio: 0.1667, creditRatio: 0 },
      { accountCode: "401000", label: "Fournisseur", debitRatio: 0, creditRatio: 1 },
    ],
  },
  {
    id: "BANK_PAYMENT_RECEIVED_BQUE",
    label: "Encaissement règlement locataire",
    journalType: "BQUE",
    lines: [
      { accountCode: "512000", label: "Banque", debitRatio: 1, creditRatio: 0 },
      { accountCode: "411000", label: "Locataire", debitRatio: 0, creditRatio: 1 },
    ],
  },
  {
    id: "BANK_PAYMENT_SENT_BQUE",
    label: "Paiement fournisseur",
    journalType: "BQUE",
    lines: [
      { accountCode: "401000", label: "Fournisseur", debitRatio: 1, creditRatio: 0 },
      { accountCode: "512000", label: "Banque", debitRatio: 0, creditRatio: 1 },
    ],
  },
] as const;

/**
 * Retourne le modèle correspondant à l'id passé, ou `null` si l'id est
 * inconnu (notamment "none" côté UI).
 */
export function getJournalEntryTemplate(id: string | null | undefined): JournalEntryTemplate | null {
  if (!id) return null;
  return JOURNAL_ENTRY_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Arrondit un montant à 2 décimales (centimes d'euros) de manière stable.
 * Utilisé pour appliquer un ratio sans propager d'erreurs flottantes.
 */
export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}
