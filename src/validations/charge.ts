import { z } from "zod";

export const createChargeCategorySchema = z.object({
  buildingId: z.string().cuid(),
  name: z.string().min(1, "Le nom est requis").max(200),
  nature: z.enum(["PROPRIETAIRE", "RECUPERABLE", "MIXTE"]),
  recoverableRate: z.coerce.number().min(0).max(100).default(100),
  allocationMethod: z
    .enum(["TANTIEME", "SURFACE", "NB_LOTS", "COMPTEUR", "PERSONNALISE"])
    .default("TANTIEME"),
  description: z.string().optional().nullable(),
});

export const updateChargeCategorySchema = createChargeCategorySchema
  .partial()
  .extend({ id: z.string().cuid() });

export const createChargeSchema = z.object({
  buildingId: z.string().cuid(),
  categoryId: z.string().cuid(),
  description: z.string().min(1, "La description est requise"),
  amount: z.coerce.number().min(0, "Le montant doit être positif"),
  date: z.string().min(1, "La date est requise"),
  periodStart: z.string().min(1, "La date de début est requise"),
  periodEnd: z.string().min(1, "La date de fin est requise"),
  supplierName: z.string().optional().nullable(),
  isPaid: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .default(false),
  invoiceUrl: z.string().url().optional().nullable(),
});

export const updateChargeSchema = createChargeSchema
  .partial()
  .extend({ id: z.string().cuid() });

export type CreateChargeCategoryInput = z.infer<typeof createChargeCategorySchema>;
export type UpdateChargeCategoryInput = z.infer<typeof updateChargeCategorySchema>;
export type CreateChargeInput = z.infer<typeof createChargeSchema>;
export type UpdateChargeInput = z.infer<typeof updateChargeSchema>;

export const createSocietyChargeCategorySchema = z.object({
  name: z.string().min(2).max(100),
  nature: z.enum(["PROPRIETAIRE", "RECUPERABLE", "MIXTE"]),
  recoverableRate: z.coerce.number().min(0).max(100).optional().nullable(),
  allocationMethod: z.enum(["TANTIEME", "SURFACE", "NB_LOTS", "COMPTEUR", "PERSONNALISE"]).default("TANTIEME"),
  description: z.string().optional().nullable(),
});
export const updateSocietyChargeCategorySchema = createSocietyChargeCategorySchema.partial().extend({ id: z.string().cuid() });
export type CreateSocietyChargeCategoryInput = z.infer<typeof createSocietyChargeCategorySchema>;
export type UpdateSocietyChargeCategoryInput = z.infer<typeof updateSocietyChargeCategorySchema>;
