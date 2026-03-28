import { z } from "zod";

export const validateRevisionSchema = z.object({
  revisionId: z.string().cuid(),
});

export const rejectRevisionSchema = z.object({
  revisionId: z.string().cuid(),
});

export const createManualRevisionSchema = z.object({
  leaseId: z.string().cuid(),
  effectiveDate: z.string().min(1, "La date d'effet est requise"),
  newIndexValue: z.coerce.number().min(0, "La valeur d'indice doit être positive"),
});

export type ValidateRevisionInput = z.infer<typeof validateRevisionSchema>;
export type RejectRevisionInput = z.infer<typeof rejectRevisionSchema>;
export type CreateManualRevisionInput = z.infer<typeof createManualRevisionSchema>;
