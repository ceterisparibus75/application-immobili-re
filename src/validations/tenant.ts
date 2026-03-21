import { z } from "zod";

const baseSchema = z.object({
  entityType: z.enum(["PERSONNE_MORALE", "PERSONNE_PHYSIQUE"]),
  email: z.string().email("Email invalide"),
  billingEmail: z.string().email("Email de facturation invalide").optional().nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  riskIndicator: z.enum(["VERT", "ORANGE", "ROUGE"]).default("VERT"),
  notes: z.string().optional().nullable(),
});

const moralSchema = baseSchema.extend({
  entityType: z.literal("PERSONNE_MORALE"),
  companyName: z.string().min(2, "La raison sociale est requise"),
  companyLegalForm: z.string().optional().nullable(),
  siret: z
    .string()
    .regex(/^\d{14}$/, "SIRET invalide (14 chiffres)")
    .optional()
    .nullable(),
  siren: z.string().optional().nullable(),
  codeAPE: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  shareCapital: z.coerce.number().min(0).optional().nullable(),
  legalRepName: z.string().optional().nullable(),
  legalRepTitle: z.string().optional().nullable(),
  legalRepEmail: z.string().email().optional().nullable(),
  legalRepPhone: z.string().optional().nullable(),
});

const physicalSchema = baseSchema.extend({
  entityType: z.literal("PERSONNE_PHYSIQUE"),
  lastName: z.string().min(1, "Le nom est requis"),
  firstName: z.string().min(1, "Le prénom est requis"),
  birthDate: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  personalAddress: z.string().optional().nullable(),
  autoEntrepreneurSiret: z
    .string()
    .regex(/^\d{14}$/, "SIRET invalide (14 chiffres)")
    .optional()
    .nullable(),
});

export const createTenantSchema = z.discriminatedUnion("entityType", [
  moralSchema,
  physicalSchema,
]);

export const updateTenantSchema = z.object({
  id: z.string().cuid(),
  entityType: z.enum(["PERSONNE_MORALE", "PERSONNE_PHYSIQUE"]),
  email: z.string().email("Email invalide").optional(),
  billingEmail: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  riskIndicator: z.enum(["VERT", "ORANGE", "ROUGE"]).optional(),
  notes: z.string().optional().nullable(),
  // Morale
  companyName: z.string().optional().nullable(),
  companyLegalForm: z.string().optional().nullable(),
  siret: z.string().regex(/^\d{14}$/).optional().nullable(),
  siren: z.string().optional().nullable(),
  codeAPE: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  shareCapital: z.coerce.number().min(0).optional().nullable(),
  legalRepName: z.string().optional().nullable(),
  legalRepTitle: z.string().optional().nullable(),
  legalRepEmail: z.string().email().optional().nullable(),
  legalRepPhone: z.string().optional().nullable(),
  // Physique
  lastName: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  personalAddress: z.string().optional().nullable(),
  autoEntrepreneurSiret: z.string().regex(/^\d{14}$/).optional().nullable(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
