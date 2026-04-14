import { z } from "zod";

// ─── Config inbox email ────────────────────────────────────────────────────────

export const upsertSupplierInboxConfigSchema = z.object({
  notifyEmails: z.array(z.string().email("Email invalide")).max(5),
  isActive: z.boolean().default(true),
});
export type UpsertSupplierInboxConfigInput = z.infer<typeof upsertSupplierInboxConfigSchema>;

// ─── Upload manuel ────────────────────────────────────────────────────────────

export const uploadSupplierInvoiceSchema = z.object({
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(1),
  fileUrl: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
});
export type UploadSupplierInvoiceInput = z.infer<typeof uploadSupplierInvoiceSchema>;

// ─── Mise à jour des données (tous champs optionnels sauf id) ─────────────────

export const updateSupplierInvoiceDataSchema = z.object({
  id: z.string().cuid(),
  supplierName: z.string().min(1).max(200).optional().nullable(),
  supplierIban: z
    .string()
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/, "IBAN invalide")
    .optional()
    .nullable(),
  supplierBic: z.string().max(11).optional().nullable(),
  invoiceNumber: z.string().max(50).optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  amountHT: z.coerce.number().min(0).optional().nullable(),
  amountVAT: z.coerce.number().min(0).optional().nullable(),
  amountTTC: z.coerce.number().min(0).optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  buildingId: z.string().cuid().optional().nullable(),
  leaseId: z.string().cuid().optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
});
export type UpdateSupplierInvoiceDataInput = z.infer<typeof updateSupplierInvoiceDataSchema>;

// ─── Validation (champs obligatoires vérifiés en action) ─────────────────────

export const validateSupplierInvoiceSchema = z.object({
  invoiceId: z.string().cuid(),
});

// ─── Rejet ────────────────────────────────────────────────────────────────────

export const rejectSupplierInvoiceSchema = z.object({
  invoiceId: z.string().cuid(),
  reason: z.string().min(1, "Raison requise").max(500),
});

// ─── Paiement manuel ──────────────────────────────────────────────────────────

export const markSupplierInvoicePaidSchema = z.object({
  invoiceId: z.string().cuid(),
  paidAt: z.string().min(1),
  bankAccountId: z.string().cuid(),
  reference: z.string().max(140).optional().nullable(),
});
export type MarkSupplierInvoicePaidInput = z.infer<typeof markSupplierInvoicePaidSchema>;
