// Barrel — agrège les Server Actions liées au cashflow.

export type {
  CategoryBreakdown,
  CashflowMonthDetail,
  CashflowDashboard,
  UncategorizedTransaction,
  BankAccountSummary,
  RecategorizableTransaction,
} from "@/actions/cashflow-shared";

export {
  getCashflowDashboard,
  getUncategorizedTransactions,
  getRecentTransactions,
} from "@/actions/cashflow-queries";

export {
  categorizeTransactions,
  aiSuggestCategories,
  applyAutoTag,
} from "@/actions/cashflow-mutations";
