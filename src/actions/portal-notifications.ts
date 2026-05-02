"use server";

import { prisma } from "@/lib/prisma";
import { requireSocietyActionContext } from "@/lib/action-society";
import { sendMail } from "@/lib/email";
import { createAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import type { ActionResult } from "@/actions/society";

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function buildNotificationHtml(tenantName: string, period: string, portalUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#334155;max-width:600px;margin:0 auto;padding:32px 16px;">
  <p style="font-size:18px;font-weight:700;color:#0C2340;">Votre quittance est disponible</p>
  <p>Bonjour <strong>${tenantName}</strong>,</p>
  <p>Votre quittance de loyer pour la période <strong>${period}</strong> est disponible dans votre espace locataire.</p>
  <p style="margin:24px 0;">
    <a href="${portalUrl}/portal/documents" style="background:#1B4F8A;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">
      Accéder à mon espace
    </a>
  </p>
  <p style="color:#94A3B8;font-size:12px;">Cet email a été envoyé automatiquement. Répondez pour contacter votre gestionnaire.</p>
</body></html>`;
}

export async function notifyTenantNewQuittance(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ emailId?: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: {
        tenant: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            entityType: true,
            companyName: true,
          },
        },
      },
    });

    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.invoiceType !== "QUITTANCE")
      return { success: false, error: "Cette facture n'est pas une quittance" };
    if (!invoice.fileUrl)
      return { success: false, error: "La quittance n'a pas encore de PDF disponible" };
    if (!invoice.tenant?.email)
      return { success: false, error: "Le locataire n'a pas d'adresse email" };

    const tenantName =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? (invoice.tenant.companyName ?? "Locataire")
        : `${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim() ||
          "Locataire";

    const period =
      invoice.periodStart && invoice.periodEnd
        ? `${fmtMonthYear(invoice.periodStart)} – ${fmtMonthYear(invoice.periodEnd)}`
        : fmtMonthYear(invoice.issueDate);

    const siteUrl = env.AUTH_URL ?? "https://app.mygestia.immo";

    const result = await sendMail(
      invoice.tenant.email,
      `Votre quittance ${period} est disponible`,
      buildNotificationHtml(tenantName, period, siteUrl)
    );

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { event: "PORTAL_QUITTANCE_NOTIFICATION", emailId: result.emailId },
    });

    return { success: true, data: { emailId: result.emailId } };
  } catch (error) {
    console.error("[notifyTenantNewQuittance]", error);
    return { success: false, error: "Erreur lors de l'envoi de la notification" };
  }
}
