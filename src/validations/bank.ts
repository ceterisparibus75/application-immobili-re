import { z } from "zod";

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1, "Le nom de la banque est requis"),
  accountName: z.string().min(1, "Le nom du compte est requis"),
  iban: z
    .string()
    .min(15, "IBAN invalide")
    .max(34, "IBAN invalide")
    .transform((v) => v.replace(/\s/g, "").toUpperCase()),
  initialBalance: z.coerce.number().default(0),
});

export const updateBankAccountSchema = z.object({
  id: z.string().cuid(),
  bankName: z.string().min(1).optional(),
  accountName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const createBankTransactionSchema = z.object({
  bankAccountId: z.string().cuid(),
  transactionDate: z.string().min(1),
  amount: z.coerce.number(),
  label: z.string().min(1, "Le libellé est requis"),
  reference: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type CreateBankTransactionInput = z.infer<typeof createBankTransactionSchema>;
