import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInsuranceReminderEmail } from "@/lib/email";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  // Vérifier le secret cron
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET non configure" } }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non autorise" } }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Locataires actifs avec portail actif, sans assurance, invités il y a 30+ jours
    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
        insuranceUploadedAt: null,
        portalAccess: {
          isActive: true,
          invitedAt: { lt: thirtyDaysAgo },
        },
        OR: [
          { insuranceReminderSentAt: null },
          { insuranceReminderSentAt: { lt: thirtyDaysAgo } },
        ],
      },
      include: {
        society: { select: { name: true } },
      },
    });

    let sent = 0;
    const portalUrl = env.AUTH_URL;

    for (const tenant of tenants) {
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
        data: { insuranceReminderSentAt: new Date() },
      });

      sent++;
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("[cron/insurance-reminder]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
