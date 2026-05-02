import { z } from "zod";

export const fixedAssetCategorySchema = z.enum([
  "STRUCTURE",
  "FACADE_TOITURE",
  "INSTALLATIONS_TECHNIQUES",
  "AGENCEMENTS_AMENAGEMENTS",
  "MOBILIER_EQUIPEMENTS",
  "TRAVAUX_COPROPRIETE",
  "AUTRE",
]);

export const createFixedAssetSchema = z.object({
  name: z.string().min(2, "Le nom de l'immobilisation est obligatoire"),
  description: z.string().optional(),
  category: fixedAssetCategorySchema.default("AUTRE"),
  buildingId: z.string().cuid("Immeuble invalide"),
  supplierInvoiceId: z.string().cuid().optional(),
  acquisitionJournalEntryId: z.string().cuid().optional(),
  assetAccountId: z.string().cuid("Compte d'immobilisation invalide"),
  depreciationAccountId: z.string().cuid("Compte d'amortissement invalide"),
  expenseAccountId: z.string().cuid("Compte de dotation invalide"),
  acquisitionDate: z.coerce.date(),
  serviceStartDate: z.coerce.date(),
  depreciableBase: z.coerce.number().positive("La base amortissable doit être positive"),
  residualValue: z.coerce.number().min(0).default(0),
  durationMonths: z.coerce.number().int().min(1).max(1200),
}).refine((data) => data.residualValue < data.depreciableBase, {
  path: ["residualValue"],
  message: "La valeur résiduelle doit être inférieure à la base amortissable",
});

export const postFixedAssetDepreciationSchema = z.object({
  fixedAssetId: z.string().cuid(),
  fiscalYear: z.coerce.number().int().min(1900).max(2200),
});

export type CreateFixedAssetInput = z.input<typeof createFixedAssetSchema>;
export type PostFixedAssetDepreciationInput = z.input<typeof postFixedAssetDepreciationSchema>;
