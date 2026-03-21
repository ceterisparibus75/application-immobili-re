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
  description: z.string().optional(),
});

export const updateBuildingSchema = createBuildingSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
