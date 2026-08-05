import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { buildDailyDigestForUser, getEligibleUserIdsForDigest } from "@/lib/daily-digest";
import { sendDailyDigestEmail } from "@/lib/email";

/**
 * Cron : envoie le digest quotidien à chaque utilisateur éligible.
 *
 * Planifié à 7h30 UTC (soit 8h30/9h30 Paris selon saison). Silencieux
 * quand rien à signaler : un utilisateur sans action à traiter ne reçoit
 * PAS d'email (calm inbox).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!verifyCronSecret(authHeader)) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  try {
    const userIds = await getEligibleUserIdsForDigest();
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];
    const now = new Date();

    for (const userId of userIds) {
      try {
        const digest = await buildDailyDigestForUser(userId, now);
        if (!digest) {
          skipped++;
          continue;
        }
        if (digest.totals.grandTotal === 0) {
          // Rien à signaler = pas d'email
          skipped++;
          continue;
        }
        const result = await sendDailyDigestEmail({
          to: digest.userEmail,
          recipientName: digest.userName,
          societies: digest.societies,
          totals: digest.totals,
          date: now,
        });
        if (result.success) {
          sent++;
          await prisma.user.update({
            where: { id: userId },
            data: { dailyDigestLastSentAt: now },
          });
        } else {
          errors.push(`User ${userId}: ${result.error ?? "erreur envoi"}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`User ${userId}: ${msg}`);
      }
    }

    if (errors.length > 0) {
      console.error("[cron/daily-digest]", `${sent} envoyes, ${skipped} ignores, ${errors.length} erreurs`, errors);
    }
    return NextResponse.json({ success: true, sent, skipped, errors: errors.length });
  } catch (error) {
    console.error("[cron/daily-digest]", error);
    return NextResponse.json({ error: "Erreur lors du digest quotidien" }, { status: 500 });
  }
}
