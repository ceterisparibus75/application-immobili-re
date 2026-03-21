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
  issueDate: z.string().min(1, "La date d'émission est requise"),
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

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
