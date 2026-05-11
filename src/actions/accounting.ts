// Barrel — agrège les Server Actions de comptabilité.
// API publique inchangée après le découpage en cinq sous-fichiers :
//   - accounting-shared.ts          : types, helpers privés et helpers IO partagés
//   - accounting-fiscal-years.ts    : exercices fiscaux + à-nouveaux
//   - accounting-accounts.ts        : plan comptable et comptes fréquents
//   - accounting-reports.ts         : balance + grand livre
//   - accounting-journal-entries.ts : créer / modifier / valider / supprimer les écritures
//   - accounting-import.ts          : imports massifs + plan comptable par défaut

export type {
  AccountRow,
  AccountingDocumentOption,
  BalanceRow,
  FiscalYearCloseCheck,
  FiscalYearCloseChecklist,
  FiscalYearRow,
  FrequentAccountRow,
  GrandLivreRow,
} from "@/actions/accounting-shared";

export {
  getFiscalYears,
  createFiscalYear,
  closeFiscalYear,
  getFiscalYearCloseChecklist,
  generateOpeningEntries,
} from "@/actions/accounting-fiscal-years";

export {
  getAccounts,
  getAccountingDocumentOptions,
  getFrequentAccountsForJournal,
} from "@/actions/accounting-accounts";

export { getBalance, getGrandLivre } from "@/actions/accounting-reports";

export {
  createJournalEntry,
  updateJournalEntry,
  linkJournalEntryDocument,
  deleteJournalEntry,
  validateJournalEntry,
  validateJournalEntries,
} from "@/actions/accounting-journal-entries";

export type {
  ImportJournalEntryInput,
  BulkImportJournalEntriesOptions,
  SkippedImportJournalEntry,
} from "@/actions/accounting-import";

export {
  bulkImportAccounts,
  bulkImportJournalEntries,
  initDefaultChartOfAccounts,
} from "@/actions/accounting-import";
