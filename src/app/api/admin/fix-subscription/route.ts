import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, planIdFromPriceId } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    // 1. Lister les souscriptions Stripe récentes (dernières 100)
    const stripeSubscriptions = await getStripe().subscriptions.list({
      limit: 100,
      status: "all",
      expand: ["data.customer"],
    });

    results["stripe_subscriptions_found"] = stripeSubscriptions.data.length;

    for (const stripeSub of stripeSubscriptions.data) {
      const societyId = stripeSub.metadata?.societyId;
      if (!societyId) {
        // Chercher via le checkout session
        const sessions = await getStripe().checkout.sessions.list({
          subscription: stripeSub.id,
          limit: 1,
        });
        const session = sessions.data[0];
        const sid = session?.metadata?.societyId;

        if (!sid) {
          results[`stripe_${stripeSub.id}`] = {
            action: "skip",
            reason: "no societyId in metadata",
            customerEmail: typeof stripeSub.customer === "object" ? (stripeSub.customer as { email?: string }).email : null,
          };
          continue;
        }

        // Traiter avec le societyId trouvé via la session
        await syncSubscription(sid, stripeSub, results);
        continue;
      }

      await syncSubscription(societyId, stripeSub, results);
    }

    // 2. Afficher l'état final des subscriptions en BDD
    const dbSubs = await prisma.subscription.findMany({
      select: {
        societyId: true,
        planId: true,
        status: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });
    results["db_subscriptions"] = dbSubs;

  } catch (err) {
    results["error"] = String(err);
  }

  return NextResponse.json(results);
}

async function syncSubscription(
  societyId: string,
  stripeSub: { id: string; status: string; customer: string | { id: string }; items: { data: Array<{ price?: { id: string } }> }; metadata: Record<string, string>; trial_start: number | null; trial_end: number | null; cancel_at: number | null; canceled_at: number | null },
  results: Record<string, unknown>
) {
  const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id;
  const priceId = stripeSub.items.data[0]?.price?.id ?? null;
  const resolvedPlanId = (priceId ? planIdFromPriceId(priceId) : null)
    ?? (stripeSub.metadata?.planId as string | undefined)
    ?? null;

  const statusMap: Record<string, string> = {
    trialing: "TRIALING", active: "ACTIVE", past_due: "PAST_DUE",
    canceled: "CANCELED", unpaid: "UNPAID", incomplete: "INCOMPLETE",
  };
  const mappedStatus = statusMap[stripeSub.status] ?? "INCOMPLETE";

  // Vérifier qu'une subscription existe en BDD pour cette société
  const existing = await prisma.subscription.findUnique({ where: { societyId } });
  if (!existing) {
    results[`society_${societyId}`] = { action: "skip", reason: "no subscription record in DB" };
    return;
  }

  await prisma.subscription.update({
    where: { societyId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId,
      planId: (resolvedPlanId ?? existing.planId) as "STARTER" | "PRO" | "ENTERPRISE",
      status: mappedStatus as "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE",
      trialStart: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000) : existing.trialStart,
      trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : existing.trialEnd,
      cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
      canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
    },
  });

  results[`society_${societyId}`] = {
    action: "synced",
    stripeSubId: stripeSub.id,
    customerId,
    priceId,
    resolvedPlanId,
    planIdFromPriceResult: priceId ? planIdFromPriceId(priceId) : "no_price",
    metadataPlanId: stripeSub.metadata?.planId ?? "none",
    stripeStatus: stripeSub.status,
    mappedStatus,
    oldPlanId: existing.planId,
    newPlanId: resolvedPlanId ?? existing.planId,
  };
}
