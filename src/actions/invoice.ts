"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createInvoiceSchema,
  recordPaymentSchema,
  type CreateInvoiceInput,
  type RecordPaymentInput,
} from "@/validations/invoice";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

function computeLines(
  lines: { label: string; quantity: number; unitPrice: number; vatRate: number }[]
) {
  return lines.map((line) => {
    const totalHT = line.quantity * line.unitPrice;
    const totalVAT = totalHT * (line.vatRate / 100);
    return {
      label: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
      totalHT,
      totalVAT,
      totalTTC: totalHT + totalVAT,
    };
  });
}

async function getNextInvoiceNumber(societyId: string): Promise<string> {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { id: true },
  });
  if (!society) throw new Error("Société introuvable");

  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: {
      societyId,
      issueDate: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });

  const prefix = societyId.slice(0, 4).toUpperCase();
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function createInvoice(
  societyId: string,
  input: CreateInvoiceInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = createInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.data.tenantId, societyId, isActive: true },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    const computedLines = computeLines(parsed.data.lines);
    const totalHT = computedLines.reduce((s, l) => s + l.totalHT, 0);
    const totalVAT = computedLines.reduce((s, l) => s + l.totalVAT, 0);
    const totalTTC = totalHT + totalVAT;

    const invoiceNumber = await getNextInvoiceNumber(societyId);

    const invoice = await prisma.invoice.create({
      data: {
        societyId,
        tenantId: parsed.data.tenantId,
        leaseId: parsed.data.leaseId ?? null,
        invoiceNumber,
        invoiceType: parsed.data.invoiceType,
        status: "EN_ATTENTE",
        issueDate: new Date(parsed.data.issueDate),
        dueDate: new Date(parsed.data.dueDate),
        periodStart: parsed.data.periodStart
          ? new Date(parsed.data.periodStart)
          : null,
        periodEnd: parsed.data.periodEnd
          ? new Date(parsed.data.periodEnd)
          : null,
        totalHT,
        totalVAT,
        totalTTC,
        lines: {
          create: computedLines,
        },
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      details: { invoiceNumber, totalTTC, tenantId: parsed.data.tenantId },
    });

    revalidatePath("/facturation");
    if (parsed.data.leaseId) revalidatePath(`/baux/${parsed.data.leaseId}`);

    return { success: true, data: { id: invoice.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createInvoice]", error);
    return { success: false, error: "Erreur lors de la création de la facture" };
  }
}

export async function recordPayment(
  societyId: string,
  input: RecordPaymentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: parsed.data.invoiceId, societyId },
      include: { payments: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const payment = await prisma.payment.create({
      data: {
        invoiceId: parsed.data.invoiceId,
        amount: parsed.data.amount,
        paidAt: new Date(parsed.data.paidAt),
        method: parsed.data.method ?? null,
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    // Calculer le total payé et mettre à jour le statut
    const totalPaid =
      invoice.payments.reduce((s, p) => s + p.amount, 0) + parsed.data.amount;
    let newStatus: "EN_ATTENTE" | "PAYE" | "PARTIELLEMENT_PAYE" | "EN_RETARD" | "LITIGIEUX" =
      "EN_ATTENTE";
    if (totalPaid >= invoice.totalTTC) {
      newStatus = "PAYE";
    } else if (totalPaid > 0) {
      newStatus = "PARTIELLEMENT_PAYE";
    }

    await prisma.invoice.update({
      where: { id: parsed.data.invoiceId },
      data: { status: newStatus },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Invoice",
      entityId: parsed.data.invoiceId,
      details: { paymentAmount: parsed.data.amount, newStatus },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${parsed.data.invoiceId}`);

    return { success: true, data: { id: payment.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[recordPayment]", error);
    return { success: false, error: "Erreur lors de l'enregistrement du paiement" };
  }
}

export async function getInvoices(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.invoice.findMany({
    where: { societyId },
    include: {
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: { select: { payments: true } },
    },
    orderBy: [{ dueDate: "desc" }],
  });
}

export async function getInvoiceById(societyId: string, invoiceId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.invoice.findFirst({
    where: { id: invoiceId, societyId },
    include: {
      tenant: true,
      lease: {
        select: {
          id: true,
          lot: {
            select: {
              number: true,
              building: { select: { name: true, city: true } },
            },
          },
        },
      },
      lines: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
}
