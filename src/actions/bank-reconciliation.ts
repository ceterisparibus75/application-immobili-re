// Barrel — agrège les Server Actions et les types liés au rapprochement bancaire.
// Conserve la stabilité de l'API publique (`import { x } from "@/actions/bank-reconciliation"`)
// après le découpage en quatre fichiers :
//   - bank-reconciliation-shared.ts    : types, constantes, helpers purs et IO partagés
//   - bank-reconciliation-queries.ts   : lectures (getXxx) — "use server"
//   - bank-reconciliation-mutations.ts : mutations (autoReconcile, manualReconcile…) — "use server"

export type {
  BankReconciliationSuggestion,
  ReconciliationCandidate,
  ReconciliationCandidateKind,
} from "@/actions/bank-reconciliation-shared";

export {
  getUnreconciledTransactions,
  getUnreconciledPayments,
  getReconciledItems,
  getPendingInvoices,
  getUpcomingLoanLines,
  getSupplierInvoicesToReconcile,
  getUnreconciledBalanceAdjustments,
  getBankReconciliationSuggestions,
} from "@/actions/bank-reconciliation-queries";

export {
  autoReconcile,
  manualReconcile,
  unreconcile,
  generateJournalEntry,
  generateMissingBankJournalEntries,
  reconcileWithSupplierInvoice,
  reconcileWithBalanceAdjustment,
  reconcileWithJournalEntry,
  reconcileWithInvoice,
  reconcileWithLoanLine,
} from "@/actions/bank-reconciliation-mutations";
