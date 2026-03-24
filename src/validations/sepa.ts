import { z } from "zod";

export const createSepaMandateSchema = z.object({
  iban: z.string()
    .min(15, "IBAN trop court")
    .max(34, "IBAN trop long")
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/, "Format IBAN invalide"),
  accountHolderName: z.string().min(2, "Nom titulaire requis"),
});

export const createSepaPaymentSchema = z.object({
  mandateId: z.string().cuid("ID mandat invalide"),
  invoiceId: z.string().cuid("ID facture invalide"),
  amount: z.number().positive("Montant doit être positif"),
  description: z.string().optional(),
  chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)").optional(),
});

export type CreateSepaMandateInput = z.infer<typeof createSepaMandateSchema>;
export type CreateSepaPaymentInput = z.infer<typeof createSepaPaymentSchema>;
