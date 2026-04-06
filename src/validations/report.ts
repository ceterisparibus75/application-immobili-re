import { z } from "zod";

/**
 * Validation des paramètres de génération de rapports.
 */

export const REPORT_TYPES = [
  "SITUATION_LOCATIVE",
  "COMPTE_RENDU_GESTION",
  "RENTABILITE_LOT",
  "ETAT_IMPAYES",
  "RECAP_CHARGES_LOCATAIRE",
  "SUIVI_TRAVAUX",
  "BALANCE_AGEE",
  "SUIVI_MENSUEL",
  "VACANCE_LOCATIVE",
] as const;

export const generateReportSchema = z
  .object({
    type: z.enum(REPORT_TYPES, {
      errorMap: () => ({ message: "Type de rapport invalide" }),
    }),
    year: z
      .number()
      .int()
      .min(2000, "L'année doit être supérieure à 2000")
      .max(2100, "L'année doit être inférieure à 2100")
      .optional(),
    buildingId: z.string().cuid().optional(),
    tenantId: z.string().cuid().optional(),
    format: z.enum(["pdf", "xlsx"]).default("pdf"),
  })
  .superRefine((data, ctx) => {
    // Le rapport "RECAP_CHARGES_LOCATAIRE" nécessite un tenantId
    if (data.type === "RECAP_CHARGES_LOCATAIRE" && !data.tenantId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "L'identifiant du locataire est requis pour le récapitulatif des charges",
        path: ["tenantId"],
      });
    }

    // Les rapports annuels nécessitent une année
    const yearRequired = [
      "COMPTE_RENDU_GESTION",
      "RENTABILITE_LOT",
      "RECAP_CHARGES_LOCATAIRE",
      "SUIVI_TRAVAUX",
      "SUIVI_MENSUEL",
    ];
    if (yearRequired.includes(data.type) && !data.year) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "L'année est requise pour ce type de rapport",
        path: ["year"],
      });
    }
  });

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// ── Planification de rapports consolidés ────────────────────────

export const REPORT_FREQUENCIES = ["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"] as const;

/** Rapports éligibles à la consolidation (PDF uniquement, pas de tenant-specific) */
export const CONSOLIDABLE_REPORT_TYPES = [
  "SITUATION_LOCATIVE",
  "COMPTE_RENDU_GESTION",
  "BALANCE_AGEE",
  "SUIVI_MENSUEL",
  "VACANCE_LOCATIVE",
] as const;

export const createReportScheduleSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),
  frequency: z.enum(REPORT_FREQUENCIES, {
    errorMap: () => ({ message: "Fréquence invalide" }),
  }),
  reportTypes: z
    .array(z.enum(CONSOLIDABLE_REPORT_TYPES))
    .min(1, "Sélectionnez au moins un type de rapport"),
  recipients: z
    .array(z.string().email("Adresse email invalide"))
    .min(1, "Ajoutez au moins un destinataire"),
});

export const updateReportScheduleSchema = createReportScheduleSchema
  .partial()
  .extend({
    id: z.string().cuid(),
    isActive: z.boolean().optional(),
  });

export type CreateReportScheduleInput = z.infer<typeof createReportScheduleSchema>;
export type UpdateReportScheduleInput = z.infer<typeof updateReportScheduleSchema>;
