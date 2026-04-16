import { prisma } from "@/lib/prisma";
import { PLANS, getStripe, planIdFromPriceId } from "@/lib/stripe";
import type { PlanId } from "@/lib/stripe";

/**
 * Verifie si une societe a atteint la limite de lots de son plan.
 * Retourne { allowed: true } ou { allowed: false, message: string }.
 */
export async function checkLotLimit(societyId: string): Promise<{ allowed: boolean; message?: string }> {
  const plan = await getSocietyPlan(societyId);
  const limits = PLANS[plan];

  if (limits.maxLots === -1) return { allowed: true };

  const count = await prisma.lot.count({
    where: { building: { societyId } },
  });
  if (count >= limits.maxLots) {
    return {
      allowed: false,
      message: `Limite de ${limits.maxLots} lots atteinte pour le plan ${limits.name}. Passez au plan supérieur.`,
    };
  }
  return { allowed: true };
}

/**
 * Verifie si un utilisateur a atteint la limite de societes de son plan.
 */
export async function checkSocietyLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  const userSocieties = await prisma.userSociety.findMany({
    where: { userId },
    select: { societyId: true },
  });

  if (userSocieties.length === 0) return { allowed: true };

  let maxAllowed = 1;
  for (const us of userSocieties) {
    const plan = await getSocietyPlan(us.societyId);
    const limits = PLANS[plan];
    if (limits.maxSocieties === -1) return { allowed: true };
    if (limits.maxSocieties > maxAllowed) maxAllowed = limits.maxSocieties;
  }

  if (userSocieties.length >= maxAllowed) {
    return {
      allowed: false,
      message: `Limite de ${maxAllowed} sociétés atteinte. Passez au plan supérieur.`,
    };
  }
  return { allowed: true };
}

/**
 * Verifie si une societe a atteint la limite d'utilisateurs de son plan.
 */
export async function checkUserLimit(societyId: string): Promise<{ allowed: boolean; message?: string }> {
  const plan = await getSocietyPlan(societyId);
  const limits = PLANS[plan];

  if (limits.maxUsers === -1) return { allowed: true };

  const count = await prisma.userSociety.count({ where: { societyId } });
  if (count >= limits.maxUsers) {
    return {
      allowed: false,
      message: `Limite de ${limits.maxUsers} utilisateurs atteinte pour le plan ${limits.name}. Passez au plan supérieur.`,
    };
  }
  return { allowed: true };
}

/**
 * Verifie si l'abonnement d'une societe est actif (non expire, non annule).
 * Gère aussi l'expiration de l'essai implicite (trialEnd dépassé).
 * Si un abonnement Stripe existe et que le statut DB n'est pas ACTIVE,
 * effectue une synchronisation Stripe silencieuse avant de décider.
 */
export async function checkSubscriptionActive(societyId: string): Promise<{
  active: boolean;
  message?: string;
  status?: string;
  trialEnd?: Date | null;
  daysLeft?: number;
}> {
  let subscription = await prisma.subscription.findUnique({
    where: { societyId },
  });

  // Pas d'abonnement du tout = pas de société valide
  if (!subscription) {
    return {
      active: false,
      status: "NONE",
      message: "Aucun abonnement trouvé. Veuillez souscrire un plan.",
    };
  }

  // Si le statut n'est pas ACTIVE et qu'un abonnement Stripe existe,
  // tenter une synchronisation silencieuse depuis Stripe
  if (subscription.status !== "ACTIVE" && subscription.stripeSubscriptionId) {
    try {
      const stripeSub = await getStripe().subscriptions.retrieve(subscription.stripeSubscriptionId);
      const statusMap: Record<string, string> = {
        trialing: "TRIALING", active: "ACTIVE", past_due: "PAST_DUE",
        canceled: "CANCELED", unpaid: "UNPAID", incomplete: "INCOMPLETE",
        incomplete_expired: "CANCELED", paused: "CANCELED",
      };
      const newStatus = statusMap[stripeSub.status] ?? "INCOMPLETE";
      const priceId = stripeSub.items.data[0]?.price?.id ?? null;
      const resolvedPlanId = (priceId ? planIdFromPriceId(priceId) : null)
        ?? (stripeSub.metadata?.planId as PlanId | undefined)
        ?? subscription.planId;
      const item = stripeSub.items?.data?.[0];
      const rawItem = item as unknown as Record<string, unknown>;
      const periodEnd = typeof rawItem?.current_period_end === "number"
        ? new Date(rawItem.current_period_end * 1000) : null;

      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: newStatus as "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE",
          planId: resolvedPlanId as "STARTER" | "PRO" | "ENTERPRISE",
          stripePriceId: priceId,
          currentPeriodEnd: periodEnd,
          trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : subscription.trialEnd,
          cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
          ...(stripeSub.trial_end ? { trialUsed: true } : {}),
        },
      });
    } catch {
      // En cas d'erreur Stripe, continuer avec les données locales
    }
  }

  // Statuts actifs
  if (subscription.status === "ACTIVE") {
    return { active: true, status: "ACTIVE" };
  }

  // Essai en cours : vérifier si la date d'expiration est dépassée
  if (subscription.status === "TRIALING") {
    if (subscription.trialEnd && new Date() > subscription.trialEnd) {
      // Trial expiré — basculer en CANCELED automatiquement
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELED" },
      });
      return {
        active: false,
        status: "TRIAL_EXPIRED",
        trialEnd: subscription.trialEnd,
        message: "Votre période d'essai est terminée. Souscrivez un abonnement pour continuer.",
      };
    }
    // Trial encore actif
    const daysLeft = subscription.trialEnd
      ? Math.max(0, Math.ceil((subscription.trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;
    return {
      active: true,
      status: "TRIALING",
      trialEnd: subscription.trialEnd,
      daysLeft: daysLeft ?? undefined,
    };
  }

  // Tous les autres statuts (CANCELED, PAST_DUE, UNPAID, INCOMPLETE)
  return {
    active: false,
    status: subscription.status,
    message: subscription.status === "PAST_DUE"
      ? "Votre paiement a échoué. Veuillez mettre à jour votre moyen de paiement."
      : "Votre abonnement n'est plus actif. Souscrivez un plan pour continuer.",
  };
}

/**
 * Verifie si un utilisateur doit obligatoirement avoir le 2FA active.
 * C'est le cas si l'une de ses societes a un plan ENTERPRISE actif.
 */
export async function requiresTwoFactor(userId: string): Promise<boolean> {
  const memberships = await prisma.userSociety.findMany({
    where: { userId },
    include: {
      society: {
        include: {
          subscription: { select: { planId: true, status: true } },
        },
      },
    },
  });

  return memberships.some(
    (m) =>
      m.society.subscription?.planId === "ENTERPRISE" &&
      ["ACTIVE", "TRIALING"].includes(m.society.subscription?.status ?? "")
  );
}

/**
 * Verifie si une societe a acces a la signature electronique (plan ENTERPRISE uniquement).
 */
export async function checkSignatureFeature(societyId: string): Promise<{ allowed: boolean; message?: string }> {
  const plan = await getSocietyPlan(societyId);
  if (plan !== "ENTERPRISE") {
    return {
      allowed: false,
      message: "La signature electronique est reservee au plan Enterprise. Mettez a jour votre abonnement.",
    };
  }
  return { allowed: true };
}

/** Retrouve le planId d'une societe (STARTER par defaut).
 *  Si le statut n'est pas ACTIVE et qu'un abonnement Stripe existe,
 *  synchronise silencieusement depuis Stripe pour avoir le bon plan. */
async function getSocietyPlan(societyId: string): Promise<PlanId> {
  const subscription = await prisma.subscription.findUnique({
    where: { societyId },
    select: { planId: true, status: true, stripeSubscriptionId: true, id: true, stripePriceId: true },
  });

  if (!subscription) return "STARTER";

  // Sync silencieuse si statut pas ACTIVE et Stripe configuré
  if (subscription.status !== "ACTIVE" && subscription.stripeSubscriptionId) {
    try {
      const stripeSub = await getStripe().subscriptions.retrieve(subscription.stripeSubscriptionId);
      const statusMap: Record<string, string> = {
        trialing: "TRIALING", active: "ACTIVE", past_due: "PAST_DUE",
        canceled: "CANCELED", unpaid: "UNPAID", incomplete: "INCOMPLETE",
        incomplete_expired: "CANCELED", paused: "CANCELED",
      };
      const newStatus = statusMap[stripeSub.status] ?? "INCOMPLETE";
      const priceId = stripeSub.items.data[0]?.price?.id ?? null;
      const resolvedPlanId = (priceId ? planIdFromPriceId(priceId) : null)
        ?? (stripeSub.metadata?.planId as PlanId | undefined)
        ?? subscription.planId;
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: newStatus as "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE",
          planId: resolvedPlanId as "STARTER" | "PRO" | "ENTERPRISE",
          stripePriceId: priceId,
          ...(stripeSub.trial_end ? { trialUsed: true } : {}),
        },
      });
      if (newStatus === "CANCELED" || newStatus === "UNPAID") return "STARTER";
      return resolvedPlanId as PlanId;
    } catch {
      // En cas d'erreur Stripe, utiliser les données locales
    }
  }

  if (subscription.status === "CANCELED" || subscription.status === "UNPAID") return "STARTER";
  return subscription.planId as PlanId;
}
