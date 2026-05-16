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

export type {
  AllocationContext,
  AllocationTenantGroup,
  AllocationCandidateInvoice,
} from "@/actions/bank-reconciliation-queries";

export {
  getUnreconciledTransactions,
  getUnreconciledPayments,
  getReconciledItems,
  getPendingInvoices,
  getUpcomingLoanLines,
  getSupplierInvoicesToReconcile,
  getUnreconciledBalanceAdjustments,
  getBankReconciliationSuggestions,
  getAllocationContextForTransaction,
} from "@/actions/bank-reconciliation-queries";

export type { AllocationInput } from "@/actions/bank-reconciliation-mutations";

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
  reconcileTransactionWithAllocations,
} from "@/actions/bank-reconciliation-mutations";
