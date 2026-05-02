"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import type { ActionResult } from "@/actions/society";
import { requireSocietyActionContext, UnauthenticatedActionError } from "@/lib/action-society";
import { ForbiddenError } from "@/lib/permissions";

export async function generateInvoiceFromRegularization(
  societyId: string,
  regularizationId: string
): Promise<ActionResult<{ invoiceId: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const reg = await prisma.chargeRegularization.findFirst({
      where: { id: regularizationId, societyId },
      include: {
        lease: {
          select: {
            id: true,
            tenantId: true,
            lot: { select: { id: true, building: { select: { id: true } } } },
          },
        },
      },
    });

    if (!reg) return { success: false, error: "Régularisation introuvable" };
    if (!reg.isFinalized) return { success: false, error: "La régularisation doit être finalisée avant de générer une facture" };
    if (reg.balance <= 0) return { success: false, error: "Le solde est négatif ou nul : aucune facture à générer" };

    const existing = await prisma.invoice.findFirst({
      where: {
        societyId,
        leaseId: reg.leaseId,
        invoiceType: "REGULARISATION_CHARGES",
        periodStart: reg.periodStart,
        periodEnd: reg.periodEnd,
      },
    });
    if (existing) return { success: false, error: "Une facture de régularisation existe déjà pour cette période" };

    const invoice = await prisma.invoice.create({
      data: {
        societyId,
        tenantId: reg.lease.tenantId,
        leaseId: reg.leaseId,
        invoiceType: "REGULARISATION_CHARGES",
        status: "BROUILLON",
        issueDate: new Date(),
        dueDate: new Date(),
        periodStart: reg.periodStart,
        periodEnd: reg.periodEnd,
        totalHT: reg.balance,
        totalVAT: 0,
        totalTTC: reg.balance,
        lines: {
          create: [
            {
              label: `Régularisation de charges ${reg.fiscalYear}`,
              quantity: 1,
              unitPrice: reg.balance,
              vatRate: 0,
              totalHT: reg.balance,
              totalVAT: 0,
              totalTTC: reg.balance,
            },
          ],
        },
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      details: {
        event: "REGULARISATION_INVOICE_GENERATED",
        regularizationId,
        balance: reg.balance,
        fiscalYear: reg.fiscalYear,
      },
    });

    revalidatePath("/charges/comptes-rendus");
    revalidatePath("/facturation");

    return { success: true, data: { invoiceId: invoice.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[generateInvoiceFromRegularization]", error);
    return { success: false, error: "Erreur lors de la génération de la facture" };
  }
}