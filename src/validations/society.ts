import { z } from "zod";

export const createSocietySchema = z.object({
  name: z
    .string()
    .min(2, "La raison sociale doit contenir au moins 2 caractères")
    .max(200),
  legalForm: z.enum(["SCI", "SARL", "SAS", "SA", "EURL", "SASU", "SNC", "AUTRE"]),
  siret: z
    .string()
    .regex(/^\d{14}$/, "Le SIRET doit contenir exactement 14 chiffres"),
  vatNumber: z
    .string()
    .regex(/^FR\d{2}\d{9}$/, "Format TVA invalide (ex: FR12345678901)")
    .optional()
    .or(z.literal("")),
  addressLine1: z.string().min(1, "L'adresse est obligatoire"),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().min(1, "La ville est obligatoire"),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres"),
  country: z.string().default("France"),
  taxRegime: z.enum(["IS", "IR"]),
  vatRegime: z.enum(["TVA", "FRANCHISE"]),
  // Coordonnées bancaires (optionnelles à la création)
  iban: z.string().optional().or(z.literal("")),
  bic: z.string().optional().or(z.literal("")),
  bankName: z.string().optional().or(z.literal("")),
  // Expert-comptable
  accountantName: z.string().optional().or(z.literal("")),
  accountantFirm: z.string().optional().or(z.literal("")),
  accountantEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  accountantPhone: z.string().optional().or(z.literal("")),
  // Branding
  logoUrl: z.string().optional().or(z.literal("")),
  invoicePrefix: z
    .string()
    .max(10, "Le préfixe ne peut pas dépasser 10 caractères")
    .optional()
    .or(z.literal("")),
  legalMentions: z.string().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  shareCapital: z.coerce.number().min(0).optional().nullable(),
  signatoryName: z.string().max(100).optional().or(z.literal("")),
});

export const updateSocietySchema = createSocietySchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateSocietyInput = z.infer<typeof createSocietySchema>;
export type UpdateSocietyInput = z.infer<typeof updateSocietySchema>;
