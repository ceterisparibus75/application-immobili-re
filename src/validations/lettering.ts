import { z } from "zod";

/**
 * Validation pour le lettrage des ecritures comptables.
 * Le lettrage rapproche des lignes debit/credit (ex: facture <-> paiement).
 */

// Schema pour lettrer un groupe de lignes
//
// `allowImbalance` + `imbalanceReason` permettent de clôturer un lettrage
// avec un écart (ex: 2 € de change ou d'arrondi). Si activé, une OD d'écart
// est créée sur 658000 (perte) ou 758000 (produit) et la contrepartie posée
// sur le compte lettré rejoint le groupe. Un motif est obligatoire pour
// tracer la décision dans l'audit log et dans l'écriture de régularisation.
export const letterEntriesSchema = z
  .object({
    lineIds: z
      .array(z.string().cuid())
      .min(2, "Il faut au moins 2 lignes pour lettrer")
      .max(100, "Maximum 100 lignes par lettrage"),
    allowImbalance: z.boolean().optional(),
    imbalanceReason: z
      .string()
      .trim()
      .max(200, "Le motif ne peut pas dépasser 200 caractères")
      .optional(),
  })
  .refine(
    (data) => !data.allowImbalance || (data.imbalanceReason && data.imbalanceReason.length > 0),
    {
      message: "Un motif est obligatoire pour lettrer avec un écart",
      path: ["imbalanceReason"],
    }
  );

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

// Schema pour lister les groupes lettrees d un compte
export const getLetteredGroupsSchema = z.object({
  accountId: z.string().cuid(),
});

export type GetLetteredGroupsInput = z.infer<typeof getLetteredGroupsSchema>;

export const getLetteringSuggestionsSchema = z.object({
  accountId: z.string().cuid(),
});

export type GetLetteringSuggestionsInput = z.infer<typeof getLetteringSuggestionsSchema>;
