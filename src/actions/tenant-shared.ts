// Helpers PURS (sans prisma), schémas Zod et helpers de format —
// importables depuis du code client si nécessaire.
// Les fonctions qui touchent Prisma (computeTenantBalance, computeTenantBalances)
// vivent dans tenant-queries.ts pour rester dans la frontière "use server".

import { z } from "zod";

// ─── Helper pur : montant d'un avoir (signe abs) ─────────────────────────────

export function getCreditNoteAmount(totalTTC: number): number {
  return Math.abs(totalTTC);
}

// ─── Schémas Zod & helpers de format ─────────────────────────────────────────

export const tenantContactSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  role: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable(),
  phone: z.string().optional().nullable(),
});

export type TenantContactInput = z.infer<typeof tenantContactSchema>;

export function frenchDecimal(schema = z.coerce.number().finite("Le montant doit être un nombre valide")) {
  return z.preprocess(
    (value) => typeof value === "string"
      ? value.trim().replace(/\s/g, "").replace(",", ".")
      : value,
    schema
  );
}

export const tenantBalanceAdjustmentSchema = z.object({
  tenantId: z.string().cuid(),
  label: z.string().min(1, "Le libellé est requis"),
  amount: frenchDecimal().refine((amount) => amount !== 0, "Le montant doit être différent de zéro"),
  dueDate: z.string().min(1, "La date du solde est requise"),
  vatRate: frenchDecimal(z.coerce.number().finite().min(0).max(100)).optional(),
  notes: z.string().optional(),
});

export const tenantLedgerImportLineSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  label: z.string().min(1, "Le libellé est requis"),
  debit: frenchDecimal().optional().default(0),
  credit: frenchDecimal().optional().default(0),
  balanceAfter: frenchDecimal().optional(),
  reference: z.string().optional(),
  periodLabel: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export const tenantLedgerImportSchema = z.object({
  tenantId: z.string().cuid(),
  leaseId: z.string().cuid().optional().nullable(),
  lines: z.array(tenantLedgerImportLineSchema).min(1, "Aucune ligne à importer").max(1000, "Import limité à 1000 lignes"),
});
