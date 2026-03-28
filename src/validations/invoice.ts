import { z } from "zod";

export const createInvoiceSchema = z.object({
  leaseId: z.string().cuid().optional().nullable(),
  tenantId: z.string().cuid(),
  invoiceType: z.enum([
    "APPEL_LOYER",
    "QUITTANCE",
    "REGULARISATION_CHARGES",
    "REFACTURATION",
    "AVOIR",
  ]),
  dueDate: z.string().min(1, "La date d'échéance est requise"),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        label: z.string().min(1),
        quantity: z.coerce.number().positive().default(1),
        unitPrice: z.coerce.number(),
        vatRate: z.coerce.number().min(0).max(100).default(20),
      })
    )
    .min(1, "Au moins une ligne est requise"),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().cuid(),
  amount: z.coerce.number().positive("Le montant doit être positif"),
  paidAt: z.string().min(1, "La date de paiement est requise"),
  method: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Schéma pour la génération automatique d'une facture depuis un bail.
 * La période est exprimée par son mois de début (ex: "2025-01" pour janvier 2025).
 */
export const generateInvoiceFromLeaseSchema = z.object({
  leaseId: z.string().cuid(),
  periodMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format attendu : AAAA-MM"),
});

/**
 * Schéma pour la génération en masse des appels de loyers.
 */
export const generateBatchInvoicesSchema = z.object({
  periodMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format attendu : AAAA-MM"),
  leaseIds: z.array(z.string().cuid()).optional(), // si vide → tous les baux actifs
});

export const createCreditNoteSchema = z.object({
  originalInvoiceId: z.string().cuid(),
  dueDate: z.string().min(1, "La date d'échéance est requise"),
  reason: z.string().optional().nullable(),
});

export const cancelInvoiceSchema = z.object({
  invoiceId: z.string().cuid(),
  reason: z.string().optional().nullable(),
});

export const validateBatchSchema = z.object({
  invoiceIds: z.array(z.string().cuid()).min(1, "Au moins une facture requise"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type GenerateInvoiceFromLeaseInput = z.infer<typeof generateInvoiceFromLeaseSchema>;
export type GenerateBatchInvoicesInput = z.infer<typeof generateBatchInvoicesSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export type ValidateBatchInput = z.infer<typeof validateBatchSchema>;
