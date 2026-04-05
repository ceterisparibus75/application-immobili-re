import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, planIdFromPriceId } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const { secret } = await request.json();
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // 1. Lire toutes les subscriptions
  const subscriptions = await prisma.subscription.findMany({
    select: {
      id: true,
      societyId: true,
      planId: true,
      status: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
    },
  });

  const results: Record<string, unknown> = {};

  for (const sub of subscriptions) {
    const key = sub.societyId;

    // Cas 1: pas de stripeCustomerId → pas de Stripe, rien à faire
    if (!sub.stripeCustomerId) {
      results[key] = { action: "skip", reason: "no stripeCustomerId", planId: sub.planId, status: sub.status };
      continue;
    }

    // Cas 2: a un stripeCustomerId mais pas de stripeSubscriptionId → chercher via API Stripe
    if (!sub.stripeSubscriptionId) {
      try {
        const stripeSubscriptions = await getStripe().subscriptions.list({
          customer: sub.stripeCustomerId,
          limit: 1,
        });
        const stripeSub = stripeSubscriptions.data[0];
        if (!stripeSub) {
          results[key] = { action: "skip", reason: "no Stripe subscription found for customer", customerId: sub.stripeCustomerId };
          continue;
        }

        const priceId = stripeSub.items.data[0]?.price?.id ?? null;
        const resolvedPlanId = (priceId ? planIdFromPriceId(priceId) : null)
          ?? (stripeSub.metadata?.planId as string | undefined)
          ?? null;

        const statusMap: Record<string, string> = {
          trialing: "TRIALING", active: "ACTIVE", past_due: "PAST_DUE",
          canceled: "CANCELED", unpaid: "UNPAID", incomplete: "INCOMPLETE",
        };

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            stripeSubscriptionId: stripeSub.id,
            stripePriceId: priceId,
            planId: (resolvedPlanId ?? sub.planId) as "STARTER" | "PRO" | "ENTERPRISE",
            status: (statusMap[stripeSub.status] ?? sub.status) as "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE",
          },
        });

        results[key] = {
          action: "fixed_missing_subscription_id",
          stripeSubId: stripeSub.id,
          priceId,
          resolvedPlanId,
          stripeStatus: stripeSub.status,
          oldPlanId: sub.planId,
          newPlanId: resolvedPlanId ?? sub.planId,
        };
        continue;
      } catch (err) {
        results[key] = { action: "error", reason: String(err) };
        continue;
      }
    }

    // Cas 3: a un stripeSubscriptionId → vérifier la sync
    try {
      const stripeSub = await getStripe().subscriptions.retrieve(sub.stripeSubscriptionId);
      const priceId = stripeSub.items.data[0]?.price?.id ?? null;
      const resolvedPlanId = (priceId ? planIdFromPriceId(priceId) : null)
        ?? (stripeSub.metadata?.planId as string | undefined)
        ?? null;

      const statusMap: Record<string, string> = {
        trialing: "TRIALING", active: "ACTIVE", past_due: "PAST_DUE",
        canceled: "CANCELED", unpaid: "UNPAID", incomplete: "INCOMPLETE",
      };
      const mappedStatus = statusMap[stripeSub.status] ?? "INCOMPLETE";

      const needsUpdate = resolvedPlanId !== sub.planId || mappedStatus !== sub.status;

      if (needsUpdate) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            stripePriceId: priceId,
            planId: (resolvedPlanId ?? sub.planId) as "STARTER" | "PRO" | "ENTERPRISE",
            status: mappedStatus as "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE",
          },
        });

        results[key] = {
          action: "synced",
          oldPlanId: sub.planId,
          newPlanId: resolvedPlanId ?? sub.planId,
          oldStatus: sub.status,
          newStatus: mappedStatus,
          priceId,
          resolvedPlanId,
          planIdFromPriceIdResult: priceId ? planIdFromPriceId(priceId) : "no_price",
          metadataPlanId: stripeSub.metadata?.planId ?? "none",
        };
      } else {
        results[key] = {
          action: "already_synced",
          planId: sub.planId,
          status: sub.status,
          priceId,
          resolvedPlanId,
        };
      }
    } catch (err) {
      results[key] = { action: "error", reason: String(err) };
    }
  }

  return NextResponse.json({ subscriptions: subscriptions.length, results });
}
