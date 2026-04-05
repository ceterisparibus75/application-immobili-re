import { NextRequest, NextResponse } from "next/server";
import { getStripe, planIdFromPriceId } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

// ─── Helpers pour extraire les periodes depuis les items ───────────────────

function getItemPeriod(subscription: Stripe.Subscription): {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} {
  const item = subscription.items?.data?.[0];
  if (!item) return { currentPeriodStart: null, currentPeriodEnd: null };
  // Stripe v22 : current_period_start / current_period_end sur les items
  const raw = item as unknown as Record<string, unknown>;
  const start = typeof raw.current_period_start === "number" ? raw.current_period_start : null;
  const end = typeof raw.current_period_end === "number" ? raw.current_period_end : null;
  return {
    currentPeriodStart: start ? new Date(start * 1000) : null,
    currentPeriodEnd: end ? new Date(end * 1000) : null,
  };
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const societyId = session.metadata?.societyId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!societyId || !customerId || !subscriptionId) {
    console.warn("[stripe-webhook] checkout.session.completed missing metadata");
    return;
  }

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planId = priceId ? planIdFromPriceId(priceId) : null;
  const period = getItemPeriod(subscription);

  await prisma.subscription.upsert({
    where: { societyId },
    create: {
      societyId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      planId: planId ?? "STARTER",
      status: mapStripeStatus(subscription.status),
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      planId: planId ?? "STARTER",
      status: mapStripeStatus(subscription.status),
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
    },
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const societyId = subscription.metadata?.societyId;
  if (!societyId) {
    const existing = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!existing) {
      console.warn("[stripe-webhook] subscription.updated: no societyId found");
      return;
    }
    await updateSubscriptionFromStripe(existing.societyId, subscription);
    return;
  }
  await updateSubscriptionFromStripe(societyId, subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!existing) return;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  });
}

async function handlePaymentFailed(invoiceObj: unknown) {
  // Stripe v22 : extraire subscription de maniere defensive
  const invoice = invoiceObj as Record<string, unknown>;
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subscriptionId) return;

  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!existing) return;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { status: "PAST_DUE" },
  });
}

// ─── Utilities ─────────────────────────────────────────────────────────────

async function updateSubscriptionFromStripe(
  societyId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planId = priceId ? planIdFromPriceId(priceId) : null;
  const period = getItemPeriod(subscription);

  await prisma.subscription.upsert({
    where: { societyId },
    create: {
      societyId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      planId: planId ?? "STARTER",
      status: mapStripeStatus(subscription.status),
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      planId: planId ?? "STARTER",
      status: mapStripeStatus(subscription.status),
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    },
  });
}

function mapStripeStatus(
  status: Stripe.Subscription.Status
): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE" {
  const mapping: Record<string, "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE"> = {
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    incomplete: "INCOMPLETE",
    incomplete_expired: "CANCELED",
    paused: "CANCELED",
  };
  return mapping[status] ?? "INCOMPLETE";
}
