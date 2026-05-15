"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { sendReminderEmail } from "@/lib/email";
import { getAllEmailCopyBcc } from "@/lib/email-copy";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./society";
import type { ReminderLevel } from "@/generated/prisma/client";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

const LEVEL_MAP: Record<ReminderLevel, 1 | 2 | 3> = {
  RELANCE_1: 1,
  RELANCE_2: 2,
  MISE_EN_DEMEURE: 3,
  CONTENTIEUX: 3,
};

const LEVEL_SUBJECTS: Record<ReminderLevel, string> = {
  RELANCE_1: "Rappel amiable — Loyer impayé",
  RELANCE_2: "Relance formelle — Loyer impayé",
  MISE_EN_DEMEURE: "Mise en demeure de payer",
  CONTENTIEUX: "Mise en contentieux",
};

/**
 * Envoie une relance manuelle pour une facture en retard.
 * Crée un enregistrement Reminder et envoie l'email au locataire.
 */
export async function sendManualReminder(
  societyId: string,
  invoiceId: string,
  level: ReminderLevel
): Promise<ActionResult<{ reminderId: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    // Récupérer la facture avec toutes les infos nécessaires
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: {
        lease: {
          include: {
            tenant: {
              select: {
                id: true,
                email: true,
                billingEmail: true,
                entityType: true,
                companyName: true,
                firstName: true,
                lastName: true,
              },
            },
            society: { select: { name: true, id: true } },
          },
        },
        payments: { select: { amount: true } },
      },
    });

    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (!invoice.leaseId) return { success: false, error: "Facture non liée à un bail" };
    if (!invoice.lease?.tenant) return { success: false, error: "Locataire non trouvé" };

    const tenant = invoice.lease.tenant;
    const tenantEmail = tenant.billingEmail || tenant.email;
    if (!tenantEmail) return { success: false, error: "Le locataire n'a pas d'email" };

    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = (invoice.totalTTC ?? invoice.totalHT) - paid;

    const tenantName =
      tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();

    const societyName = invoice.lease.society?.name ?? "";
    const subject = LEVEL_SUBJECTS[level];

    // Créer l'enregistrement Reminder
    const reminder = await prisma.reminder.create({
      data: {
        leaseId: invoice.leaseId as string,
        tenantId: tenant.id,
        level,
        invoiceIds: [invoiceId],
        totalAmount: remaining,
        channel: "email",
        subject,
        body: `Relance ${level} pour la facture ${invoice.invoiceNumber ?? invoiceId}`,
      },
    });

    // Envoyer l'email
    const bcc = await getAllEmailCopyBcc(societyId);
    const emailResult = await sendReminderEmail({
      to: tenantEmail,
      tenantName,
      amount: remaining,
      dueDate: invoice.dueDate.toLocaleDateString("fr-FR"),
      invoiceRef: invoice.invoiceNumber ?? invoiceId,
      reminderLevel: LEVEL_MAP[level],
      societyName,
      bcc,
    });

    // Marquer comme envoyée
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        isSent: emailResult.success,
        sentAt: emailResult.success ? new Date() : null,
        emailStatus: emailResult.success ? "sent" : "failed",
      },
    });

    // Une relance effectivement envoyée sort la facture de la simple file "en retard".
    if (
      emailResult.success &&
      ["VALIDEE", "ENVOYEE", "EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE"].includes(
        invoice.status,
      )
    ) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: "RELANCEE" },
      });
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Reminder",
      entityId: reminder.id,
      details: { invoiceId, level, tenantEmail },
    });

    revalidatePath("/relances");
    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);

    if (!emailResult.success) {
      return {
        success: true,
        data: { reminderId: reminder.id },
        error: "Relance enregistrée mais l'email n'a pas pu être envoyé",
      };
    }

    return { success: true, data: { reminderId: reminder.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[sendManualReminder]", error);
    return { success: false, error: "Erreur lors de l'envoi de la relance" };
  }
}

/**
 * Envoie des relances en masse pour une liste de factures.
 * Retourne le nombre de succès et d'échecs.
 */
export async function sendBulkReminders(
  societyId: string,
  invoiceIds: string[],
  level: ReminderLevel
): Promise<ActionResult<{ sent: number; failed: number }>> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    let sent = 0;
    let failed = 0;

    for (const invoiceId of invoiceIds) {
      const result = await sendManualReminder(societyId, invoiceId, level);
      if (result.success && !result.error) sent++;
      else failed++;
    }

    return { success: true, data: { sent, failed } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[sendBulkReminders]", error);
    return { success: false, error: "Erreur lors de l'envoi des relances" };
  }
}
