"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { createCheckoutSession, createCustomerPortalSession, getStripe, PLANS, PRICE_IDS } from "@/lib/stripe";
import type { ActionResult } from "@/actions/society";
import type { PlanId } from "@/lib/stripe";

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
}>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    const subscription = await prisma.subscription.findUnique({
      where: { societyId },
    });

    // Par defaut, plan Starter si pas d'abonnement
    const planId = (subscription?.planId ?? "STARTER") as PlanId;
    const plan = PLANS[planId];

    return {
      success: true,
      data: {
        planId,
        status: subscription?.status ?? "TRIALING",
        trialEnd: subscription?.trialEnd?.toISOString() ?? null,
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
        cancelAt: subscription?.cancelAt?.toISOString() ?? null,
        features: plan.features,
        limits: {
          maxLots: plan.maxLots,
          maxSocieties: plan.maxSocieties,
          maxUsers: plan.maxUsers,
        },
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
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

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
