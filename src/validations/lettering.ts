import { z } from "zod";

/**
 * Validation pour le lettrage des ecritures comptables.
 * Le lettrage rapproche des lignes debit/credit (ex: facture <-> paiement).
 */

// Schema pour lettrer un groupe de lignes
export const letterEntriesSchema = z.object({
  lineIds: z
    .array(z.string().cuid())
    .min(2, "Il faut au moins 2 lignes pour lettrer")
    .max(100, "Maximum 100 lignes par lettrage"),
});

export type LetterEntriesInput = z.infer<typeof letterEntriesSchema>;

// Schema pour supprimer un lettrage
export const unletterEntriesSchema = z.object({
  letteringCode: z
    .string()
    .min(2, "Le code de lettrage doit contenir au moins 2 caracteres")
    .max(4, "Le code de lettrage ne peut pas depasser 4 caracteres")
    .regex(/^[A-Z]{2,4}$/, "Le code de lettrage doit etre compose de 2 a 4 lettres majuscules"),
});

export type UnletterEntriesInput = z.infer<typeof unletterEntriesSchema>;

// Schema pour lister les lignes non lettrees d un compte
export const getUnletteredEntriesSchema = z.object({
  accountId: z.string().cuid(),
});

export type GetUnletteredEntriesInput = z.infer<typeof getUnletteredEntriesSchema>;
