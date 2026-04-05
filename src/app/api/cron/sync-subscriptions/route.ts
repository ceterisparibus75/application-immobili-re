import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron job : vérifie les abonnements en essai dont le trial a expiré
 * et les passe en CANCELED si aucun paiement Stripe n'est associé.
 * Synchronise aussi les abonnements Stripe actifs si la clé est configurée.
 *
 * Schedule recommandé : quotidien à 6h30
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 1. Expirer les essais gratuits dépassés (sans client Stripe = essai implicite)
    const expiredTrials = await prisma.subscription.updateMany({
      where: {
        status: "TRIALING",
        trialEnd: { lt: now },
        stripeCustomerId: null, // Essai implicite uniquement
      },
      data: {
        status: "CANCELED",
      },
    });

    // 2. Pour les abonnements Stripe en TRIALING dont le trial est dépassé,
    //    on les laisse car Stripe gère la transition via webhook.
    //    Mais si le webhook a raté, on corrige ici.
    let stripeUpdated = 0;
    if (process.env.STRIPE_SECRET_KEY) {
      const { getStripe } = await import("@/lib/stripe");
      const stripe = getStripe();

      const staleTrials = await prisma.subscription.findMany({
        where: {
          status: "TRIALING",
          trialEnd: { lt: now },
          stripeSubscriptionId: { not: null },
        },
        select: { id: true, societyId: true, stripeSubscriptionId: true },
      });

      for (const sub of staleTrials) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId!);
          const statusMap: Record<string, string> = {
            trialing: "TRIALING",
            active: "ACTIVE",
            past_due: "PAST_DUE",
            canceled: "CANCELED",
            unpaid: "UNPAID",
            incomplete: "INCOMPLETE",
            incomplete_expired: "CANCELED",
            paused: "CANCELED",
          };
          const newStatus = statusMap[stripeSub.status] ?? "INCOMPLETE";
          if (newStatus !== "TRIALING") {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: newStatus as "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE" },
            });
            stripeUpdated++;
          }
        } catch (err) {
          console.error(`[sync-subscriptions] Error syncing ${sub.stripeSubscriptionId}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      expiredTrials: expiredTrials.count,
      stripeUpdated,
    });
  } catch (error) {
    console.error("[cron/sync-subscriptions]", error);
    return NextResponse.json(
      { error: "Erreur lors de la synchronisation des abonnements" },
      { status: 500 }
    );
  }
}
