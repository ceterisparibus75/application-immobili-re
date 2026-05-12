// Barrel — agrège les Server Actions liées aux révisions de loyer.
export type {
  ChainStep,
  CatchUpResult,
  LeaseIndexationOverview,
} from "@/actions/rent-revision-shared";

// Découpage en :
//   - rent-revision-shared.ts    : constantes + helpers (date, indices, calcul)
//   - rent-revision-queries.ts   : lectures (getPendingRevisions…) — "use server"
//   - rent-revision-mutations.ts : validations + applications — "use server"

export {
  getPendingRevisions,
  getLeaseIndexationOverview,
  previewCatchUpRevisions,
} from "@/actions/rent-revision-queries";

export {
  validateRevision,
  rejectRevision,
  createManualRevision,
  detectPendingRevisions,
  applyCatchUpRevisions,
} from "@/actions/rent-revision-mutations";
