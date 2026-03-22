import { z } from "zod";

export const createLeaseSchema = z.object({
  lotId: z.string().cuid(),
  tenantId: z.string().cuid(),
  leaseType: z.enum(["COMMERCIAL_369", "DEROGATOIRE", "PRECAIRE"]),
  startDate: z.string().min(1, "La date de début est requise"),
  durationMonths: z.coerce.number().int().min(1).default(108),
  baseRentHT: z.coerce.number().min(0, "Le loyer doit être positif"),
  depositAmount: z.coerce.number().min(0).default(0),
  paymentFrequency: z
    .enum(["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"])
    .default("MENSUEL"),
  billingTerm: z.enum(["ECHU", "A_ECHOIR"]).default("A_ECHOIR"),
  progressiveRent: z
    .array(
      z.object({
        months: z.coerce.number().int().min(1),
        rentHT: z.coerce.number().min(0),
      })
    )
    .optional()
    .nullable(),
  vatApplicable: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .default(true),
  vatRate: z.coerce.number().min(0).max(100).default(20),
  indexType: z.enum(["ILC", "ILAT", "ICC"]).optional().nullable(),
  baseIndexValue: z.coerce.number().optional().nullable(),
  baseIndexQuarter: z.string().optional().nullable(),
  revisionFrequency: z.coerce.number().int().min(1).default(12),
  rentFreeMonths: z.coerce.number().int().min(0).default(0),
  entryFee: z.coerce.number().min(0).default(0),
  tenantWorksClauses: z.string().optional().nullable(),
});

export const updateLeaseSchema = z.object({
  id: z.string().cuid(),
  status: z
    .enum([
      "EN_COURS",
      "RESILIE",
      "RENOUVELE",
      "EN_NEGOCIATION",
      "CONTENTIEUX",
    ])
    .optional(),
  currentRentHT: z.coerce.number().min(0).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  vatApplicable: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  indexType: z.enum(["ILC", "ILAT", "ICC"]).optional().nullable(),
  baseIndexValue: z.coerce.number().optional().nullable(),
  baseIndexQuarter: z.string().optional().nullable(),
  revisionFrequency: z.coerce.number().int().min(1).optional(),
  billingTerm: z.enum(["ECHU", "A_ECHOIR"]).optional(),
  paymentFrequency: z
    .enum(["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"])
    .optional(),
  tenantWorksClauses: z.string().optional().nullable(),
  entryDate: z.string().optional().nullable(),
  exitDate: z.string().optional().nullable(),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
