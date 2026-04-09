import { z } from "zod";
import { LEASE_TYPES, INDEX_TYPES } from "./lease";

export const createLeaseTemplateSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(200),
  description: z.string().max(2000).optional().nullable(),
  leaseType: z.enum(LEASE_TYPES),
  isDefault: z.boolean().default(false),

  // Clauses du modèle
  headerContent: z.string().max(10000).optional().nullable(),
  partiesClause: z.string().max(10000).optional().nullable(),
  premisesClause: z.string().max(10000).optional().nullable(),
  durationClause: z.string().max(10000).optional().nullable(),
  rentClause: z.string().max(10000).optional().nullable(),
  depositClause: z.string().max(10000).optional().nullable(),
  indexationClause: z.string().max(10000).optional().nullable(),
  chargesClause: z.string().max(10000).optional().nullable(),
  useClause: z.string().max(10000).optional().nullable(),
  maintenanceClause: z.string().max(10000).optional().nullable(),
  insuranceClause: z.string().max(10000).optional().nullable(),
  terminationClause: z.string().max(10000).optional().nullable(),
  specialConditions: z.string().max(10000).optional().nullable(),
  signatureClause: z.string().max(10000).optional().nullable(),

  // Valeurs par défaut du modèle
  defaultDurationMonths: z.coerce.number().int().min(1).optional().nullable(),
  defaultPaymentFrequency: z
    .enum(["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"])
    .optional()
    .nullable(),
  defaultBillingTerm: z.enum(["ECHU", "A_ECHOIR"]).optional().nullable(),
  defaultVatApplicable: z.boolean().optional().nullable(),
  defaultVatRate: z.coerce.number().min(0).max(100).optional().nullable(),
  defaultIndexType: z.enum(INDEX_TYPES).optional().nullable(),
  defaultDepositMonths: z.coerce.number().int().min(0).optional().nullable(),
});

export const updateLeaseTemplateSchema = createLeaseTemplateSchema
  .partial()
  .extend({
    id: z.string().cuid(),
    isActive: z.boolean().optional(),
  });

export type CreateLeaseTemplateInput = z.infer<typeof createLeaseTemplateSchema>;
export type UpdateLeaseTemplateInput = z.infer<typeof updateLeaseTemplateSchema>;
