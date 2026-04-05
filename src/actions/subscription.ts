"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { createCheckoutSession, createCustomerPortalSession, getStripe, PLANS, PRICE_IDS, planIdFromPriceId } from "@/lib/stripe";
import type { ActionResult } from "@/actions/society";
import type { PlanId } from "@/lib/stripe";

// ─── Synchroniser depuis Stripe si desync detectee ────────────────────────

async function syncFromStripeIfNeeded(subscription: {
  id: string;
  societyId: string;
  stripeSubscriptionId: string | null;
  planId: string;
  status: string;
  stripePriceId: string | null;
}): Promise<{ planId: PlanId; status: string; currentPeriodEnd: Date | null; trialEnd: Date | null; cancelAt: Date | null }> {
  // Pas de souscription Stripe → rien à sync
  if (!subscription.stripeSubscriptionId) {
    return {
      planId: (subscription.planId ?? "STARTER") as PlanId,
      status: subscription.status,
      currentPeriodEnd: null,
      trialEnd: null,
      cancelAt: null,
    };
  }

  try {
    const stripeSub = await getStripe().subscriptions.retrieve(subscription.stripeSubscriptionId);
    const priceId = stripeSub.items.data[0]?.price?.id ?? null;
    const resolvedPlanId = priceId ? planIdFromPriceId(priceId) : null;

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
    const mappedStatus = statusMap[stripeSub.status] ?? "INCOMPLETE";

    // Extraire currentPeriodEnd depuis les items (Stripe v22+)
    const item = stripeSub.items?.data?.[0];
    const rawItem = item as unknown as Record<string, unknown>;
    const periodEnd = typeof rawItem?.current_period_end === "number"
      ? new Date(rawItem.current_period_end * 1000)
      : null;

    const needsUpdate =
      (resolvedPlanId && resolvedPlanId !== subscription.planId) ||
      mappedStatus !== subscription.status ||
      (priceId && priceId !== subscription.stripePriceId);

    if (needsUpdate) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: resolvedPlanId ?? subscription.planId,
          status: mappedStatus,
          stripePriceId: priceId,
          currentPeriodEnd: periodEnd,
          trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
          cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
        },
      });
    }

    return {
      planId: (resolvedPlanId ?? subscription.planId) as PlanId,
      status: mappedStatus,
      currentPeriodEnd: periodEnd,
      trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
    };
  } catch (error) {
    console.error("[syncFromStripeIfNeeded]", error);
    // En cas d'erreur Stripe, retourner les données locales
    return {
      planId: (subscription.planId ?? "STARTER") as PlanId,
      status: subscription.status,
      currentPeriodEnd: null,
      trialEnd: null,
      cancelAt: null,
    };
  }
}

// ─── Recuperer l'abonnement actuel ─────────────────────────────────────────

export async function getSubscription(
  societyId: string
): Promise<ActionResult<{
  planId: string;
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  features: readonly string[];
  limits: { maxLots: number; maxSocieties: number; maxUsers: number };
  hasStripeCustomer: boolean;
}>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    const subscription = await prisma.subscription.findUnique({
      where: { societyId },
    });

    // Si une souscription Stripe existe, vérifier la sync
    let planId: PlanId = (subscription?.planId ?? "STARTER") as PlanId;
    let status = subscription?.status ?? "TRIALING";
    let currentPeriodEnd = subscription?.currentPeriodEnd ?? null;
    let trialEnd = subscription?.trialEnd ?? null;
    let cancelAt = subscription?.cancelAt ?? null;

    if (subscription?.stripeSubscriptionId) {
      const synced = await syncFromStripeIfNeeded({
        id: subscription.id,
        societyId: subscription.societyId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        planId: subscription.planId,
        status: subscription.status,
        stripePriceId: subscription.stripePriceId,
      });
      planId = synced.planId;
      status = synced.status;
      if (synced.currentPeriodEnd) currentPeriodEnd = synced.currentPeriodEnd;
      if (synced.trialEnd) trialEnd = synced.trialEnd;
      cancelAt = synced.cancelAt;
    }

    const plan = PLANS[planId];

    return {
      success: true,
      data: {
        planId,
        status,
        trialEnd: trialEnd?.toISOString() ?? null,
        currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
        cancelAt: cancelAt?.toISOString() ?? null,
        features: plan.features,
        limits: {
          maxLots: plan.maxLots,
          maxSocieties: plan.maxSocieties,
          maxUsers: plan.maxUsers,
        },
        hasStripeCustomer: !!subscription?.stripeCustomerId,
      },
    };
  } catch (error) {
    console.error("[getSubscription]", error);
    return { success: false, error: "Erreur lors de la recuperation" };
  }
}

// ─── Creer une session de checkout ─────────────────────────────────────────

export async function createCheckout(
  societyId: string,
  planId: PlanId,
  billingPeriod: "monthly" | "yearly"
): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const priceId = PRICE_IDS[planId]?.[billingPeriod];
    if (!priceId || priceId.trim() === "") {
      return { success: false, error: `L'offre ${planId} (${billingPeriod}) n'est pas encore configurée. Contactez le support.` };
    }

    const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
    const url = await createCheckoutSession({
      societyId,
      userId: session.user.id,
      priceId,
      successUrl: `${baseUrl}/compte/abonnement?success=true`,
      cancelUrl: `${baseUrl}/compte/abonnement?canceled=true`,
    });

    return { success: true, data: { url } };
  } catch (error) {
    console.error("[createCheckout]", error);
    return { success: false, error: "Erreur lors de la creation du checkout" };
  }
}

// ─── Ouvrir le portail client Stripe ───────────────────────────────────────

export async function openBillingPortal(
  societyId: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const subscription = await prisma.subscription.findUnique({
      where: { societyId },
    });

    if (!subscription?.stripeCustomerId) {
      return { success: false, error: "Aucun abonnement actif" };
    }

    const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
    const url = await createCustomerPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${baseUrl}/compte/abonnement`,
    });

    return { success: true, data: { url } };
  } catch (error) {
    console.error("[openBillingPortal]", error);
    return { success: false, error: "Erreur lors de l'ouverture du portail" };
  }
}

// ─── Annuler l'abonnement ──────────────────────────────────────────────────

export async function cancelCurrentSubscription(
  societyId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const subscription = await prisma.subscription.findUnique({
      where: { societyId },
    });

    if (!subscription?.stripeSubscriptionId) {
      return { success: false, error: "Aucun abonnement actif" };
    }

    await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return { success: true };
  } catch (error) {
    console.error("[cancelSubscription]", error);
    return { success: false, error: "Erreur lors de l'annulation" };
  }
}
