import { z } from "zod";

export const createBuildingSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(200),
  addressLine1: z.string().min(5, "L'adresse est requise"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "La ville est requise"),
  postalCode: z.string().regex(/^\d{5}$/, "Code postal invalide (5 chiffres)"),
  country: z.string().default("France"),
  buildingType: z.enum(["BUREAU", "COMMERCE", "MIXTE", "ENTREPOT"]),
  yearBuilt: z.coerce
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear())
    .optional()
    .nullable(),
  totalArea: z.coerce.number().positive("La surface doit être positive").optional().nullable(),
  marketValue: z.coerce.number().min(0).optional().nullable(),
  netBookValue: z.coerce.number().min(0).optional().nullable(),
  acquisitionPrice: z.coerce.number().min(0).optional().nullable(),
  acquisitionFees: z.coerce.number().min(0).optional().nullable(),
  acquisitionTaxes: z.coerce.number().min(0).optional().nullable(),
  acquisitionOtherCosts: z.coerce.number().min(0).optional().nullable(),
  acquisitionDate: z.string().optional().nullable(),
  worksCost: z.coerce.number().min(0).optional().nullable(),
  description: z.string().optional(),
});

export const updateBuildingSchema = createBuildingSchema.partial().extend({
  id: z.string().cuid(),
});

/** Acquisition complémentaire de lots */
export const additionalAcquisitionSchema = z.object({
  buildingId: z.string().cuid(),
  label: z.string().min(2, "Le libellé est requis"),
  acquisitionDate: z.string().min(1, "La date est requise"),
  acquisitionPrice: z.coerce.number().min(0, "Le prix doit être positif"),
  acquisitionFees: z.coerce.number().min(0).optional().nullable(),
  acquisitionTaxes: z.coerce.number().min(0).optional().nullable(),
  otherCosts: z.coerce.number().min(0).optional().nullable(),
  description: z.string().optional().nullable(),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
export type AdditionalAcquisitionInput = z.infer<typeof additionalAcquisitionSchema>;
