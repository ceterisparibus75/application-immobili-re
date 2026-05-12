// Barrel — agrège les Server Actions liées aux emprunts.
// Découpage en :
//   - loan-shared.ts    : types, schémas, generateAmortizationTable
//   - loan-queries.ts   : getLoans / getLoanById / getLoanMovements / getBudgetLines
//   - loan-mutations.ts : create / update / delete / amortization / budget / movements

export {
  getLoans,
  getLoansForDebtProfile,
  getLoanById,
  getLoanMovements,
  getBudgetLines,
} from "@/actions/loan-queries";

export {
  createLoanFromPdf,
  createLoan,
  markAmortizationLinePaid,
  updateAmortizationLine,
  updateLoan,
  deleteLoan,
  regenerateAmortizationTable,
  upsertBudgetLine,
  addLoanMovement,
  deleteLoanMovement,
} from "@/actions/loan-mutations";
