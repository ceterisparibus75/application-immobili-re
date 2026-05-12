// Helpers, schémas Zod et calculs de solde locataire — pas de "use server".

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  requireSocietyActionContext,
} from "@/lib/action-society";

// ============================================================
// CALCUL DU SOLDE LOCATAIRE
// ============================================================

/**
 * Calcule le solde d'un locataire (montant dû).
 * Solde = ajustements manuels + factures TTC (hors annulées) - paiements - avoirs.
 * Un solde positif = le locataire doit de l'argent.
 */
function getCreditNoteAmount(totalTTC: number): number {
  return Math.abs(totalTTC);
}

export async function computeTenantBalance(societyId: string, tenantId: string): Promise<number> {
  await requireSocietyActionContext(societyId);

  const [invoices, adjustments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        societyId,
        tenantId,
        status: { notIn: ["ANNULEE", "BROUILLON"] },
        invoiceType: { not: "QUITTANCE" },
      },
      select: {
        totalTTC: true,
        invoiceType: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.tenantBalanceAdjustment.findMany({
      where: { societyId, tenantId },
      select: { amount: true },
    }),
  ]);

  let balance = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    if (inv.invoiceType === "AVOIR") {
      // Un avoir réduit le solde
      balance -= getCreditNoteAmount(inv.totalTTC);
    } else {
      balance += inv.totalTTC - paid;
    }
  }

  return Math.round(balance * 100) / 100;
}

/**
 * Calcule les soldes de plusieurs locataires en une seule requête optimisée.
 */
async function computeTenantBalances(societyId: string, tenantIds: string[]): Promise<Map<string, number>> {
  if (tenantIds.length === 0) return new Map();

  const [invoices, adjustments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        societyId,
        tenantId: { in: tenantIds },
        status: { notIn: ["ANNULEE", "BROUILLON"] },
        invoiceType: { not: "QUITTANCE" },
      },
      select: {
        id: true,
        tenantId: true,
        totalTTC: true,
        invoiceType: true,
      },
    }),
    prisma.tenantBalanceAdjustment.findMany({
      where: { societyId, tenantId: { in: tenantIds } },
      select: { tenantId: true, amount: true },
    }),
  ]);

  const paymentTotals = invoices.length > 0
    ? await prisma.payment.groupBy({
        by: ["invoiceId"],
        where: { invoiceId: { in: invoices.map((inv) => inv.id) } },
        _sum: { amount: true },
      })
    : [];
  const paidByInvoice = new Map(paymentTotals.map((p) => [p.invoiceId, p._sum.amount ?? 0]));

  const balances = new Map<string, number>();
  for (const adjustment of adjustments) {
    balances.set(adjustment.tenantId, (balances.get(adjustment.tenantId) ?? 0) + adjustment.amount);
  }
  for (const inv of invoices) {
    const current = balances.get(inv.tenantId) ?? 0;
    const paid = paidByInvoice.get(inv.id) ?? 0;
    if (inv.invoiceType === "AVOIR") {
      balances.set(inv.tenantId, current - getCreditNoteAmount(inv.totalTTC));
    } else {
      balances.set(inv.tenantId, current + (inv.totalTTC - paid));
    }
  }

  // Arrondir
  for (const [id, val] of balances) {
    balances.set(id, Math.round(val * 100) / 100);
  }

  return balances;
}

const tenantContactSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  role: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable(),
  phone: z.string().optional().nullable(),
});

type TenantContactInput = z.infer<typeof tenantContactSchema>;

function frenchDecimal(schema = z.coerce.number().finite("Le montant doit être un nombre valide")) {
  return z.preprocess(
    (value) => typeof value === "string"
      ? value.trim().replace(/\s/g, "").replace(",", ".")
      : value,
    schema
  );
}

const tenantBalanceAdjustmentSchema = z.object({
  tenantId: z.string().cuid(),
  label: z.string().min(1, "Le libellé est requis"),
  amount: frenchDecimal().refine((amount) => amount !== 0, "Le montant doit être différent de zéro"),
  dueDate: z.string().min(1, "La date du solde est requise"),
  vatRate: frenchDecimal(z.coerce.number().finite().min(0).max(100)).optional(),
  notes: z.string().optional(),
});

const tenantLedgerImportLineSchema = z.object({
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

const tenantLedgerImportSchema = z.object({
  tenantId: z.string().cuid(),
  leaseId: z.string().cuid().optional().nullable(),
  lines: z.array(tenantLedgerImportLineSchema).min(1, "Aucune ligne à importer").max(1000, "Import limité à 1000 lignes"),
});

/**
 * Importe un solde précédent dans le compte locataire.
 * Ce mouvement n'est pas une facture : il ne génère aucun numéro de facture.
 */

export {
  getCreditNoteAmount,
  computeTenantBalances,
  frenchDecimal,
  tenantContactSchema,
  tenantBalanceAdjustmentSchema,
  tenantLedgerImportSchema,
  tenantLedgerImportLineSchema,
};
export type { TenantContactInput };
