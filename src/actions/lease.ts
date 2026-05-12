// Barrel — agrège les Server Actions liées aux baux.
// Découpage en :
//   - lease-shared.ts    : helpers (formatTenantName) et LEASE_INCLUDE
//   - lease-queries.ts   : lectures (getLeases, getLeaseById…) — "use server"
//   - lease-mutations.ts : créations / modifications / paliers — "use server"

export {
  getLeases,
  getLeasesPaginated,
  getLeaseById,
  getLeaseFinancialSummary,
  getLeaseDocuments,
  getRentSteps,
} from "@/actions/lease-queries";

export {
  createLease,
  updateLease,
  transferLeaseTenant,
  deleteLease,
  createRentSteps,
  updateRentStep,
  deleteRentStep,
} from "@/actions/lease-mutations";
