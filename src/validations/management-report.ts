import { z } from "zod";

export const createManagementReportSchema = z.object({
  leaseId: z.string().cuid(),
  periodStart: z.string().min(1, "La date de début est requise"),
  periodEnd: z.string().min(1, "La date de fin est requise"),
  grossRent: z.coerce.number().min(0, "Le loyer brut doit être positif"),
  chargesAmount: z.coerce.number().min(0).optional().nullable(),
  feeAmountHT: z.coerce.number().min(0, "Les honoraires HT sont requis"),
  feeAmountTTC: z.coerce.number().min(0, "Les honoraires TTC sont requis"),
  netTransfer: z.coerce.number().min(0, "Le montant net est requis"),
  notes: z.string().max(5000).optional().nullable(),
});

export const updateManagementReportSchema = createManagementReportSchema
  .partial()
  .extend({
    id: z.string().cuid(),
  });

export type CreateManagementReportInput = z.infer<typeof createManagementReportSchema>;
export type UpdateManagementReportInput = z.infer<typeof updateManagementReportSchema>;
