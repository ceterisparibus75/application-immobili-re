import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in90Days = new Date(now);
    in90Days.setDate(in90Days.getDate() + 90);

    // Baux actifs expirant dans les 90 prochains jours
    const expiringLeases = await prisma.lease.findMany({
      where: {
        status: "EN_COURS",
        endDate: { gte: now, lte: in90Days },
      },
      include: {
        tenant: {
          select: {
            entityType: true,
            companyName: true,
            firstName: true,
            lastName: true,
          },
        },
        lot: {
          select: {
            number: true,
            building: { select: { name: true } },
          },
        },
      },
    });

    let notificationsCreated = 0;

    for (const lease of expiringLeases) {
      const daysUntilExpiry = Math.ceil(
        (lease.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const tenantName =
        lease.tenant.entityType === "PERSONNE_MORALE"
          ? (lease.tenant.companyName ?? "")
          : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim();

      // Récupérer tous les utilisateurs de cette société (pour les notifier)
      const societyUsers = await prisma.userSociety.findMany({
        where: { societyId: lease.societyId },
        select: { userId: true },
      });

      // Vérifier qu'une notification similaire n'existe pas déjà ce mois
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const existing = await prisma.notification.findFirst({
        where: {
          societyId: lease.societyId,
          type: "BAIL_EXPIRING",
          link: `/baux/${lease.id}`,
          createdAt: { gte: startOfMonth },
        },
      });
      if (existing) continue;

      // Créer une notification pour chaque utilisateur de la société
      for (const { userId } of societyUsers) {
        await prisma.notification.create({
          data: {
            userId,
            societyId: lease.societyId,
            type: "BAIL_EXPIRING",
            title: `Bail expirant dans ${daysUntilExpiry} jours`,
            message: `Le bail de ${tenantName} pour le lot ${lease.lot.number} (${lease.lot.building.name}) expire le ${lease.endDate.toLocaleDateString("fr-FR")}.`,
            link: `/baux/${lease.id}`,
          },
        });
      }
      notificationsCreated++;
    }

    // Diagnostics expirant dans les 30 prochains jours
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const expiringDiagnostics = await prisma.diagnostic.findMany({
      where: {
        expiresAt: { gte: now, lte: in30Days },
      },
      include: {
        building: {
          select: { id: true, name: true, societyId: true },
        },
      },
    });

    for (const diag of expiringDiagnostics) {
      if (!diag.expiresAt) continue;

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const existing = await prisma.notification.findFirst({
        where: {
          societyId: diag.building.societyId,
          type: "DIAGNOSTIC_EXPIRING",
          link: `/patrimoine/immeubles/${diag.building.id}`,
          createdAt: { gte: startOfMonth },
        },
      });
      if (existing) continue;

      const daysLeft = Math.ceil(
        (diag.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Récupérer les utilisateurs de la société
      const societyUsers = await prisma.userSociety.findMany({
        where: { societyId: diag.building.societyId },
        select: { userId: true },
      });

      for (const { userId } of societyUsers) {
        await prisma.notification.create({
          data: {
            userId,
            societyId: diag.building.societyId,
            type: "DIAGNOSTIC_EXPIRING",
            title: `Diagnostic ${diag.type} expire dans ${daysLeft} jours`,
            message: `Le diagnostic ${diag.type} de l'immeuble ${diag.building.name} expire le ${diag.expiresAt.toLocaleDateString("fr-FR")}.`,
            link: `/patrimoine/immeubles/${diag.building.id}`,
          },
        });
      }
      notificationsCreated++;
    }

    return NextResponse.json({
      success: true,
      expiringLeases: expiringLeases.length,
      expiringDiagnostics: expiringDiagnostics.length,
      notificationsCreated,
    });
  } catch (error) {
    console.error("[cron/lease-alerts]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
