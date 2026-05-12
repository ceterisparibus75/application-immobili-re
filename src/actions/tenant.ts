"use server";

// Barrel — agrège les Server Actions liées aux locataires.
// API publique inchangée après le découpage en :
//   - tenant-shared.ts    : helpers, schémas Zod et calculs de solde
//   - tenant-queries.ts   : lectures (getXxx) — "use server"
//   - tenant-mutations.ts : créations / modifications / mutations financières — "use server"



export {
  computeTenantBalance,
  getTenantsPaginated,
  getTenants,
  getActiveTenants,
  getTenantById,
  getTenantAccountStatement,
  getTenantsForSelect,
} from "@/actions/tenant-queries";

export {
  createTenant,
  updateTenant,
  deactivateTenant,
  createTenantContact,
  updateTenantContact,
  deleteTenant,
  deleteTenantContact,
  inviteOrReinviteTenant,
  syncTenantsToContacts,
  createTenantBalanceAdjustment,
  importTenantLedgerStatement,
  createManualDebit,
} from "@/actions/tenant-mutations";
