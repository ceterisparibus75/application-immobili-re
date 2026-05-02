import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInsuranceReminderEmail, sendInsuranceExpiryEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET non configure" } }, { status: 500 });
  }
  if (!verifyCronSecret(authHeader)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non autorise" } }, { status: 401 });
  }

  try {
    const portalUrl = env.AUTH_URL ?? "https://app.mygestia.immo";
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    let sent = 0;

    // --- Cas 1 : assurance manquante (comportement existant) ---
    const tenantsMissing = await prisma.tenant.findMany({
      where: {
        isActive: true,
        insuranceUploadedAt: null,
        portalAccess: { isActive: true, invitedAt: { lt: thirtyDaysAgo } },
        OR: [
          { insuranceReminderSentAt: null },
          { insuranceReminderSentAt: { lt: thirtyDaysAgo } },
        ],
      },
      include: { society: { select: { name: true } } },
    });

    for (const tenant of tenantsMissing) {
      const tenantName =
        tenant.entityType === "PERSONNE_MORALE"
          ? (tenant.companyName ?? "")
          : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();

      await sendInsuranceReminderEmail({
        to: tenant.email,
        tenantName,
        societyName: tenant.society.name,
        portalUrl,
      });

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { insuranceReminderSentAt: now },
      });

      sent++;
    }

    // --- Cas 2 : assurance expirante ou expirée ---
    const tenantsExpiring = await prisma.tenant.findMany({
      where: {
        isActive: true,
        insuranceUploadedAt: { not: null },
        insuranceExpiresAt: { not: null, lte: sixtyDaysFromNow },
        portalAccess: { isActive: true },
        OR: [
          { insuranceReminderSentAt: null },
          { insuranceReminderSentAt: { lt: fourteenDaysAgo } },
        ],
      },
      include: { society: { select: { name: true } } },
    });

    for (const tenant of tenantsExpiring) {
      if (!tenant.insuranceExpiresAt) continue;

      const daysLeft = Math.ceil(
        (tenant.insuranceExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      const tenantName =
        tenant.entityType === "PERSONNE_MORALE"
          ? (tenant.companyName ?? "")
          : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();

      await sendInsuranceExpiryEmail({
        to: tenant.email,
        tenantName,
        societyName: tenant.society.name,
        expiresAt: tenant.insuranceExpiresAt,
        portalUrl,
        daysLeft,
      });

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { insuranceReminderSentAt: now },
      });

      sent++;
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("[cron/insurance-reminder]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
