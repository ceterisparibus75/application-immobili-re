import Stripe from "stripe";

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY est requis");
  }
  return new Stripe(key, {
    apiVersion: "2025-04-30.basil",
    typescript: true,
  });
}

/** Stripe client — initialisé paresseusement pour ne pas bloquer le build sans clé */
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) _stripe = getStripeClient();
  return _stripe;
}

// ─── Plans et tarification ─────────────────────────────────────────────────

export const PLANS = {
  STARTER: {
    name: "Starter",
    maxLots: 20,
    maxSocieties: 1,
    maxUsers: 2,
    features: [
      "Gestion de patrimoine",
      "Baux et locataires",
      "Facturation",
      "Tableau de bord",
    ],
  },
  PRO: {
    name: "Pro",
    maxLots: 50,
    maxSocieties: 3,
    maxUsers: 5,
    features: [
      "Tout Starter +",
      "Comptabilite complete",
      "Connexion bancaire",
      "Relances automatiques",
      "Export FEC",
      "Portail locataire",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    maxLots: -1, // illimite
    maxSocieties: -1,
    maxUsers: -1,
    features: [
      "Tout Pro +",
      "Lots et societes illimites",
      "Signature electronique",
      "Import IA de documents",
      "Support prioritaire",
      "API access",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlanLimits(planId: PlanId) {
  return PLANS[planId];
}

// ─── Price mapping ─────────────────────────────────────────────────────────

export const PRICE_IDS = {
  STARTER: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? "",
  },
  PRO: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  },
  ENTERPRISE: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "",
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? "",
  },
} as const;

/** Retrouve le planId a partir d'un Stripe priceId */
export function planIdFromPriceId(priceId: string): PlanId | null {
  for (const [plan, prices] of Object.entries(PRICE_IDS)) {
    if (prices.monthly === priceId || prices.yearly === priceId) {
      return plan as PlanId;
    }
  }
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function createCheckoutSession(params: {
  societyId: string;
  userId: string;
  priceId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      trial_period_days: params.trialDays ?? 14,
      metadata: {
        societyId: params.societyId,
        userId: params.userId,
        planId: params.planId,
      },
    },
    metadata: {
      societyId: params.societyId,
      userId: params.userId,
      planId: params.planId,
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

export async function createCustomerPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return session.url;
}

export async function getSubscription(subscriptionId: string) {
  return getStripe().subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string) {
  return getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}
