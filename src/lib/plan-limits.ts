import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";
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
      message: `Limite de ${limits.maxLots} lots atteinte pour le plan ${limits.name}. Passez au plan superieur.`,
    };
  }
  return { allowed: true };
}

/**
 * Verifie si un utilisateur a atteint la limite de societes de son plan.
 */
export async function checkSocietyLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  // Trouver le plan le plus eleve parmi les societes de l'utilisateur
  const userSocieties = await prisma.userSociety.findMany({
    where: { userId },
    select: { societyId: true },
  });

  if (userSocieties.length === 0) return { allowed: true };

  // Verifier le plan de la premiere societe (le plus restrictif s'applique)
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
      message: `Limite de ${maxAllowed} societes atteinte. Passez au plan superieur.`,
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
      message: `Limite de ${limits.maxUsers} utilisateurs atteinte pour le plan ${limits.name}. Passez au plan superieur.`,
    };
  }
  return { allowed: true };
}

/**
 * Verifie si l'abonnement d'une societe est actif (non expire, non annule).
 */
export async function checkSubscriptionActive(societyId: string): Promise<{ active: boolean; message?: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { societyId },
  });

  // Pas d'abonnement = periode d'essai implicite (nouveau compte)
  if (!subscription) return { active: true };

  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    return { active: true };
  }

  return {
    active: false,
    message: "Votre abonnement n'est plus actif. Veuillez mettre a jour votre moyen de paiement.",
  };
}

/** Retrouve le planId d'une societe (STARTER par defaut) */
async function getSocietyPlan(societyId: string): Promise<PlanId> {
  const subscription = await prisma.subscription.findUnique({
    where: { societyId },
    select: { planId: true, status: true },
  });

  if (!subscription) return "STARTER";
  if (subscription.status === "CANCELED" || subscription.status === "UNPAID") return "STARTER";
  return subscription.planId as PlanId;
}
