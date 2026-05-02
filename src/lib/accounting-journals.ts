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

const LEGACY_TO_CANONICAL: Partial<Record<AccountingJournalType, AccountingJournalType>> = {
  VENTES: "VT",
  BANQUE: "BQUE",
  OPERATIONS_DIVERSES: "OD",
};

export function isAccountingJournalType(value: string): value is AccountingJournalType {
  return ACCOUNTING_JOURNAL_TYPES.includes(value as AccountingJournalType);
}

export function normalizeAccountingJournalType(value: AccountingJournalType): AccountingJournalType {
  return LEGACY_TO_CANONICAL[value] ?? value;
}
