import { z } from "zod";

export const PROVISION_LABELS = [
  "Provision sur charges",
  "Taxe foncière",
  "Assurance",
  "Entretien",
  "Autre",
] as const;

export const createChargeProvisionSchema = z.object({
  leaseId: z.string().cuid(),
  lotId: z.string().cuid(),
  label: z.string().min(1, "Le libellé est requis").max(100),
  monthlyAmount: z.coerce
    .number()
    .min(0.01, "Le montant doit être supérieur à 0"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().optional().nullable(),
});

export const updateChargeProvisionSchema = createChargeProvisionSchema
  .omit({ leaseId: true, lotId: true })
  .extend({
    id: z.string().cuid(),
    isActive: z.boolean().optional(),
  });

export type CreateChargeProvisionInput = z.infer<typeof createChargeProvisionSchema>;
export type UpdateChargeProvisionInput = z.infer<typeof updateChargeProvisionSchema>;
