import { z } from "zod";

/**
 * Un mapping doit avoir exactement UNE clé parmi `cashflowCategoryId` et
 * `keyword`. Les deux à vide (ou les deux renseignés) est un cas d'erreur.
 */
export const upsertAccountingCategoryMappingSchema = z
  .object({
    id: z.string().cuid().optional(),
    cashflowCategoryId: z.string().trim().min(1).max(64).nullish(),
    keyword: z.string().trim().min(1).max(128).nullish(),
    accountCode: z
      .string()
      .trim()
      .min(2, "Le code PCG doit comporter au moins 2 caractères")
      .max(16, "Le code PCG ne doit pas dépasser 16 caractères"),
    accountLabel: z.string().trim().max(256).nullish(),
    notes: z.string().trim().max(1024).nullish(),
  })
  .refine(
    (input) =>
      Boolean(input.cashflowCategoryId) !== Boolean(input.keyword),
    {
      message:
        "Renseigner soit une catégorie cashflow, soit un mot-clé (pas les deux)",
      path: ["cashflowCategoryId"],
    }
  );

export type UpsertAccountingCategoryMappingInput = z.infer<
  typeof upsertAccountingCategoryMappingSchema
>;
