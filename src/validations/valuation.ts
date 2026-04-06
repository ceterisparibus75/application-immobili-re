import { z } from "zod";

// ============================================================
// Évaluation immobilière (valeur vénale)
// ============================================================

export const createValuationSchema = z.object({
  buildingId: z.string().cuid("Identifiant d'immeuble invalide"),
});

export const runAiAnalysisSchema = z.object({
  providers: z
    .array(z.enum(["CLAUDE", "MISTRAL"]))
    .min(1, "Au moins un fournisseur IA requis"),
});

export const uploadExpertReportSchema = z.object({
  expertName: z.string().min(2, "Le nom de l'expert est requis"),
  reportDate: z.string().min(1, "La date du rapport est requise"),
  reportReference: z.string().optional(),
});

export const searchComparablesSchema = z.object({
  radiusKm: z.coerce
    .number()
    .min(0.5, "Rayon minimum : 0,5 km")
    .max(50, "Rayon maximum : 50 km")
    .default(5),
  periodYears: z.coerce
    .number()
    .int()
    .min(1, "Période minimum : 1 an")
    .max(10, "Période maximum : 10 ans")
    .default(3),
  propertyTypes: z
    .array(z.string())
    .optional(),
});

export const updateValuationResultsSchema = z.object({
  estimatedValueLow: z.coerce.number().min(0).optional().nullable(),
  estimatedValueMid: z.coerce.number().min(0).optional().nullable(),
  estimatedValueHigh: z.coerce.number().min(0).optional().nullable(),
  estimatedRentalValue: z.coerce.number().min(0).optional().nullable(),
  pricePerSqm: z.coerce.number().min(0).optional().nullable(),
  capitalizationRate: z.coerce.number().min(0).max(100).optional().nullable(),
});

// ============================================================
// Évaluation des loyers
// ============================================================

export const createRentValuationSchema = z.object({
  leaseId: z.string().cuid("Identifiant de bail invalide"),
});

export const runRentAiAnalysisSchema = z.object({
  providers: z
    .array(z.enum(["CLAUDE", "MISTRAL"]))
    .min(1, "Au moins un fournisseur IA requis"),
});

export const searchComparableRentsSchema = z.object({
  radiusKm: z.coerce
    .number()
    .min(0.5, "Rayon minimum : 0,5 km")
    .max(50, "Rayon maximum : 50 km")
    .default(5),
  periodYears: z.coerce
    .number()
    .int()
    .min(1, "Période minimum : 1 an")
    .max(10, "Période maximum : 10 ans")
    .default(3),
  propertyTypes: z.array(z.string()).optional(),
});

// ============================================================
// Types exportés
// ============================================================

export type CreateValuationInput = z.infer<typeof createValuationSchema>;
export type RunAiAnalysisInput = z.infer<typeof runAiAnalysisSchema>;
export type UploadExpertReportInput = z.infer<typeof uploadExpertReportSchema>;
export type SearchComparablesInput = z.infer<typeof searchComparablesSchema>;
export type UpdateValuationResultsInput = z.infer<typeof updateValuationResultsSchema>;
export type CreateRentValuationInput = z.infer<typeof createRentValuationSchema>;
export type RunRentAiAnalysisInput = z.infer<typeof runRentAiAnalysisSchema>;
export type SearchComparableRentsInput = z.infer<typeof searchComparableRentsSchema>;
