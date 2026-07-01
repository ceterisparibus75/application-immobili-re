"use server";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { ForbiddenError } from "@/lib/permissions";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Détecte les transactions bancaires dont la somme des allocations
 * (BankReconciliation.amount) dépasse le montant de la transaction elle-même.
 *
 * Cas historique : virement 1 400 € rapproché à deux factures de 700 €
 * chacune, mais avant le fix efbd7c7 chaque Payment était créé avec
 * amount = transaction.amount (= 1 400 €) au lieu d'être plafonné à
 * min(txRemaining, invoiceUnpaid) — total alloué 2 800 € pour 1 400 €
 * réellement versés.
 */
export async function detectOverAllocatedTransactions(
  societyId: string,
): Promise<
  ActionResult<
    Array<{
      transactionId: string;
      transactionDate: Date;
      transactionAmount: number;
      transactionLabel: string;
      transactionReference: string | null;
      totalAllocated: number;
      overage: number;
      allocations: Array<{
        reconciliationId: string;
        paymentId: string;
        currentAmount: number;
        proposedAmount: number;
        invoiceId: string;
        invoiceNumber: string | null;
        invoiceTotalTTC: number;
        tenantId: string;
        tenantLabel: string;
      }>;
    }>
  >
> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const transactions = await prisma.bankTransaction.findMany({
      where: { bankAccount: { societyId }, amount: { gt: 0 } },
      select: {
        id: true,
        transactionDate: true,
        amount: true,
        label: true,
        reference: true,
        reconciliations: {
          select: {
            id: true,
            amount: true,
            paymentId: true,
            payment: {
              select: {
                id: true,
                amount: true,
                invoiceId: true,
                invoice: {
                  select: {
                    id: true,
                    invoiceNumber: true,
                    totalTTC: true,
                    tenantId: true,
                    tenant: {
                      select: {
                        entityType: true,
                        firstName: true,
                        lastName: true,
                        companyName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const anomalies = transactions
      .map((tx) => {
        const totalAllocated = tx.reconciliations.reduce(
          (s, r) => s + Number(r.amount),
          0,
        );
        return { tx, totalAllocated };
      })
      .filter(({ tx, totalAllocated }) => totalAllocated > tx.amount + 0.01)
      .map(({ tx, totalAllocated }) => {
        const scale = tx.amount / totalAllocated;
        return {
          transactionId: tx.id,
          transactionDate: tx.transactionDate,
          transactionAmount: tx.amount,
          transactionLabel: tx.label,
          transactionReference: tx.reference,
          totalAllocated: round2(totalAllocated),
          overage: round2(totalAllocated - tx.amount),
          allocations: tx.reconciliations.map((r) => {
            const t = r.payment.invoice?.tenant;
            const tenantLabel = t
              ? t.entityType === "PERSONNE_MORALE"
                ? t.companyName ?? "—"
                : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—"
              : "—";
            return {
              reconciliationId: r.id,
              paymentId: r.paymentId,
              currentAmount: round2(Number(r.amount)),
              proposedAmount: round2(Number(r.amount) * scale),
              invoiceId: r.payment.invoiceId,
              invoiceNumber: r.payment.invoice?.invoiceNumber ?? null,
              invoiceTotalTTC: r.payment.invoice?.totalTTC ?? 0,
              tenantId: r.payment.invoice?.tenantId ?? "",
              tenantLabel,
            };
          }),
        };
      });

    return { success: true, data: anomalies };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[detectOverAllocatedTransactions]", error);
    return { success: false, error: "Erreur lors de la détection" };
  }
}

/**
 * Corrige une transaction sur-affectée en scalant proportionnellement
 * chaque BankReconciliation et son Payment associé. Le montant total alloué
 * après correction est exactement égal au montant de la transaction.
 *
 * Le statut de chaque facture concernée est recalculé en fonction du nouveau
 * total payé.
 */
export async function repairOverAllocation(
  societyId: string,
  transactionId: string,
): Promise<ActionResult<{ scaledAmount: number; touchedInvoices: string[] }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const tx = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, bankAccount: { societyId } },
      select: {
        id: true,
        amount: true,
        reconciliations: {
          select: {
            id: true,
            amount: true,
            paymentId: true,
            payment: {
              select: { id: true, amount: true, invoiceId: true },
            },
          },
        },
      },
    });
    if (!tx) return { success: false, error: "Transaction introuvable" };
    if (tx.amount <= 0)
      return {
        success: false,
        error: "Cette réparation ne s'applique qu'aux transactions créditrices",
      };
    if (tx.reconciliations.length === 0)
      return { success: false, error: "Aucun rapprochement à corriger" };

    const totalAllocated = tx.reconciliations.reduce(
      (s, r) => s + Number(r.amount),
      0,
    );
    if (totalAllocated <= tx.amount + 0.01)
      return {
        success: false,
        error: "Cette transaction n'est pas sur-affectée",
      };

    const scale = tx.amount / totalAllocated;
    const touchedInvoices = new Set<string>();

    await prisma.$transaction(async (prismaTx) => {
      for (const r of tx.reconciliations) {
        const newAmount = round2(Number(r.amount) * scale);
        await prismaTx.bankReconciliation.update({
          where: { id: r.id },
          data: { amount: newAmount },
        });
        // On aligne Payment.amount sur BankReconciliation.amount pour que le
        // relevé locataire (qui affiche Payment.amount) et le calcul du solde
        // facture restent cohérents.
        await prismaTx.payment.update({
          where: { id: r.paymentId },
          data: { amount: newAmount },
        });
        touchedInvoices.add(r.payment.invoiceId);
      }

      // Recalcule le statut de chaque facture touchée.
      for (const invoiceId of touchedInvoices) {
        const invoice = await prismaTx.invoice.findUnique({
          where: { id: invoiceId },
          select: { totalTTC: true, status: true, invoiceType: true },
        });
        if (!invoice) continue;
        const paidAgg = await prismaTx.payment.aggregate({
          where: { invoiceId },
          _sum: { amount: true },
        });
        const paid = Number(paidAgg._sum.amount ?? 0);
        let newStatus: string;
        if (paid >= invoice.totalTTC - 0.01) newStatus = "PAYE";
        else if (paid > 0.01) newStatus = "PARTIELLEMENT_PAYE";
        else newStatus = "EN_ATTENTE";
        if (invoice.status !== newStatus) {
          await prismaTx.invoice.update({
            where: { id: invoiceId },
            data: { status: newStatus as never },
          });
        }
      }
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "BankTransaction",
      entityId: transactionId,
      details: {
        action: "repair_over_allocation",
        scale,
        previousTotal: round2(totalAllocated),
        newTotal: tx.amount,
        touchedInvoiceIds: [...touchedInvoices],
      },
    });

    revalidatePath("/banque");
    revalidatePath("/facturation");
    revalidatePath("/locataires");
    revalidatePath("/administration/reparation-paiements");

    return {
      success: true,
      data: {
        scaledAmount: tx.amount,
        touchedInvoices: [...touchedInvoices],
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[repairOverAllocation]", error);
    return { success: false, error: "Erreur lors de la correction" };
  }
}
