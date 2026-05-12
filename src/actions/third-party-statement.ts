// Barrel — agrège les Server Actions liées aux relevés de gestion tiers.
// Découpage en :
//   - third-party-statement-shared.ts    : types + helpers de calcul/vérification
//   - third-party-statement-queries.ts   : lectures (getXxx) — "use server"
//   - third-party-statement-mutations.ts : créations / vérification / rapprochement — "use server"

export type {
  StatementFilters,
  VerificationLineResult,
  LeaseVerificationResult,
  VerificationResult,
} from "@/actions/third-party-statement-shared";

export {
  getThirdPartyManagedLeases,
  getStatements,
  getStatementById,
} from "@/actions/third-party-statement-queries";

export {
  createStatement,
  updateStatement,
  validateStatement,
  recordStatementPayment,
  verifyManagementStatement,
  reconcileWithStatement,
  markStatementConforme,
  markStatementLitige,
  deleteStatement,
} from "@/actions/third-party-statement-mutations";
