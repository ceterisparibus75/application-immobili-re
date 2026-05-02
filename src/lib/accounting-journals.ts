export const CANONICAL_ACCOUNTING_JOURNAL_TYPES = [
  "AN",
  "AC",
  "VT",
  "BQUE",
  "OD",
  "INV",
] as const;

export const ACCOUNTING_JOURNAL_TYPES = [
  "AN",
  "AC",
  "BQUE",
  "INV",
  "OD",
  "VT",
  "VENTES",
  "BANQUE",
  "OPERATIONS_DIVERSES",
] as const;

export type AccountingJournalType = (typeof ACCOUNTING_JOURNAL_TYPES)[number];
export type CanonicalAccountingJournalType = (typeof CANONICAL_ACCOUNTING_JOURNAL_TYPES)[number];

export const ACCOUNTING_JOURNAL_LABELS: Record<AccountingJournalType, string> = {
  AN: "À nouveaux",
  AC: "Achats",
  VT: "Ventes / TVA",
  BQUE: "Banque",
  OD: "Opérations diverses",
  INV: "Investissements",
  VENTES: "Ventes / TVA",
  BANQUE: "Banque",
  OPERATIONS_DIVERSES: "Opérations diverses",
};

const LEGACY_TO_CANONICAL: Partial<Record<AccountingJournalType, CanonicalAccountingJournalType>> = {
  VENTES: "VT",
  BANQUE: "BQUE",
  OPERATIONS_DIVERSES: "OD",
};

const CANONICAL_TO_LEGACY: Partial<Record<CanonicalAccountingJournalType, AccountingJournalType[]>> = {
  VT: ["VENTES"],
  BQUE: ["BANQUE"],
  OD: ["OPERATIONS_DIVERSES"],
};

export function isAccountingJournalType(value: string): value is AccountingJournalType {
  return ACCOUNTING_JOURNAL_TYPES.includes(value as AccountingJournalType);
}

export function isCanonicalAccountingJournalType(value: string): value is CanonicalAccountingJournalType {
  return CANONICAL_ACCOUNTING_JOURNAL_TYPES.includes(value as CanonicalAccountingJournalType);
}

export function normalizeAccountingJournalType(value: AccountingJournalType): CanonicalAccountingJournalType {
  const canonical = LEGACY_TO_CANONICAL[value] ?? value;
  return isCanonicalAccountingJournalType(canonical) ? canonical : "OD";
}

export function getAccountingJournalTypeAliases(value: AccountingJournalType): AccountingJournalType[] {
  const canonical = normalizeAccountingJournalType(value);
  return [canonical, ...(CANONICAL_TO_LEGACY[canonical] ?? [])];
}
