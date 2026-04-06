import { z } from "zod";

/**
 * Validation pour la génération d'un courrier à partir d'un modèle.
 */
export const generateLetterSchema = z.object({
  templateId: z.string().min(1, "Modèle requis"),
  values: z.record(z.string(), z.string()),
  /** Optionnel : ID du locataire pour pré-remplir les variables */
  tenantId: z.string().cuid().optional(),
  /** Optionnel : ID du bail pour pré-remplir les variables */
  leaseId: z.string().cuid().optional(),
});

export type GenerateLetterInput = z.infer<typeof generateLetterSchema>;

/**
 * Validation pour la sauvegarde d'un modèle personnalisé.
 */
export const saveCustomTemplateSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(100),
  subject: z.string().min(2, "L'objet doit contenir au moins 2 caractères").max(200),
  bodyHtml: z.string().min(10, "Le corps du courrier est trop court"),
  variables: z.array(z.string()),
});

export type SaveCustomTemplateInput = z.infer<typeof saveCustomTemplateSchema>;
