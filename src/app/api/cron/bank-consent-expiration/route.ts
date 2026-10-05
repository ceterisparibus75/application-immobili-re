import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendBankConsentExpiryEmail } from "@/lib/email";
import type { NotificationType } from "@/generated/prisma/client";

/**
 * CRON : prévient les utilisateurs ayant les droits de configuration des
 * connexions bancaires (COMPTABLE et plus) à l'approche de l'expiration
 * du consentement PSD2 (90 j Powens).
 *
 * Stades d'alerte, par ordre d'importance :
 *   D-15 → premier rappel
 *   D-7  → relance intermédiaire
 *   D-2  → dernier appel
 *   EXPIRED → la synchro est stoppée
 *
 * On n'envoie qu'un email par stade : lastExpiryNoticeStage mémorise le
 * dernier stade atteint pour chaque connexion ; on ne renvoie pas en
 * arrière si la date d'expiration a bougé (reconnexion = reset du stage
 * via le callback).
 *
 * Planifié dans vercel.json : "0 8 * * *" (quotidien 8h).
 */

const STAGE_ORDER: Record<string, number> = {
  D15: 1,
  D7: 2,
  D2: 3,
  EXPIRED: 4,
};

function stageFor(daysUntil: number): "D15" | "D7" | "D2" | "EXPIRED" | null {
  if (daysUntil <= 0) return "EXPIRED";
  if (daysUntil <= 2) return "D2";
  if (daysUntil <= 7) return "D7";
  if (daysUntil <= 15) return "D15";
  return null;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const connections = await prisma.bankConnection.findMany({
    where: {
      // On couvre tous les stades (D-15 à EXPIRED) : on filtre côté SQL ce
      // qui sort du cadre pour éviter de lire toute la table.
      expiresAt: { lte: horizon },
      // Les connexions purement manuelles (sans provider) n'expirent pas.
      provider: { in: ["POWENS", "QONTO"] },
    },
    select: {
      id: true,
      societyId: true,
      provider: true,
      institutionName: true,
      expiresAt: true,
      lastExpiryNoticeStage: true,
      society: { select: { name: true } },
      bankAccounts: {
        where: { isActive: true },
        select: { accountName: true },
        take: 1,
      },
    },
  });

  const baseUrl = env.AUTH_URL ?? "http://localhost:3000";
  const results: Array<{
    connectionId: string;
    stage: string;
    recipients: number;
    skipped?: string;
  }> = [];

  for (const connection of connections) {
    if (!connection.expiresAt) continue;
    const daysUntil = Math.ceil(
      (connection.expiresAt.getTime() - now.getTime()) / 86_400_000
    );
    const stage = stageFor(daysUntil);
    if (!stage) continue;

    // Ne renvoie pas un stade déjà notifié (ou antérieur).
    if (
      connection.lastExpiryNoticeStage &&
      STAGE_ORDER[connection.lastExpiryNoticeStage] >= STAGE_ORDER[stage]
    ) {
      results.push({
        connectionId: connection.id,
        stage,
        recipients: 0,
        skipped: `already notified at ${connection.lastExpiryNoticeStage}`,
      });
      continue;
    }

    // Destinataires : tout utilisateur de la société avec droit >= COMPTABLE
    // (hiérarchie des rôles : SUPER_ADMIN > ADMIN_SOCIETE > GESTIONNAIRE > COMPTABLE > LECTURE).
    const memberships = await prisma.userSociety.findMany({
      where: {
        societyId: connection.societyId,
        role: { in: ["SUPER_ADMIN", "ADMIN_SOCIETE", "GESTIONNAIRE", "COMPTABLE"] },
      },
      select: {
        userId: true,
        user: { select: { email: true, firstName: true, name: true } },
      },
    });

    if (memberships.length === 0) {
      results.push({
        connectionId: connection.id,
        stage,
        recipients: 0,
        skipped: "no admins/accountants in society",
      });
      continue;
    }

    const accountName = connection.bankAccounts[0]?.accountName ?? "—";
    const renewUrl = `${baseUrl}/banque`;

    let sentCount = 0;
    for (const membership of memberships) {
      const email = membership.user?.email;
      if (!email) continue;

      try {
        await sendBankConsentExpiryEmail({
          to: email,
          recipientName: membership.user?.firstName ?? membership.user?.name ?? null,
          societyName: connection.society?.name ?? "",
          institutionName: connection.institutionName,
          accountName,
          expiresAt: connection.expiresAt,
          daysUntil,
          renewUrl,
          proofContext: {
            societyId: connection.societyId,
            entityType: "BankConnection",
            entityId: connection.id,
          },
        });
        sentCount++;
      } catch (err) {
        console.error("[cron/bank-consent-expiration] email error", membership.userId, err);
      }

      // Notification in-app en parallèle de l'email
      try {
        await prisma.notification.create({
          data: {
            userId: membership.userId,
            societyId: connection.societyId,
            type: "BANK_CONSENT_EXPIRING" satisfies NotificationType,
            title:
              stage === "EXPIRED"
                ? `Consentement bancaire expiré — ${connection.institutionName}`
                : `Consentement bancaire à renouveler (${connection.institutionName})`,
            message:
              stage === "EXPIRED"
                ? `La synchronisation du compte ${accountName} est stoppée. Renouvelez le consentement PSD2 pour reprendre.`
                : `Le consentement expire dans ${daysUntil} jour${daysUntil > 1 ? "s" : ""}. Renouvelez-le en un clic depuis la page Banque.`,
            link: "/banque",
          },
        });
      } catch (err) {
        console.error("[cron/bank-consent-expiration] notification error", membership.userId, err);
      }
    }

    // Mémoriser le stade atteint pour ne pas renvoyer avant qu'un nouveau
    // seuil ne soit franchi (ou qu'un reconnect ne reset le stage).
    await prisma.bankConnection.update({
      where: { id: connection.id },
      data: { lastExpiryNoticeAt: now, lastExpiryNoticeStage: stage },
    });

    results.push({ connectionId: connection.id, stage, recipients: sentCount });
  }

  return NextResponse.json({ success: true, processed: results.length, results });
}
