import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { enforceWebhookRateLimit } from "@/lib/webhook-rate-limit";

/**
 * Webhook Stripe Connect — événements relatifs aux comptes connectés
 * (paiements des locataires, statut des comptes, etc.).
 *
 * Séparé du webhook subscription (/api/webhooks/stripe) pour :
 * - isoler les secrets (chaque endpoint a son propre STRIPE_WEBHOOK_SECRET)
 * - filtrer les événements (les événements Connect ont un champ `account`)
 * - éviter les collisions checkout.session.completed entre plan MyGestia et
 *   paiement locataire.
 */

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceWebhookRateLimit(request, "stripe-connect");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("[stripe-connect webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "account.application.deauthorized":
        // Le bailleur a désautorisé depuis son dashboard Stripe : on nettoie
        await handleAccountDeauthorized(event.account);
        break;
      default:
        // Log léger pour ne pas polluer
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe-connect webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.mygestia_invoice_id;
  if (!invoiceId) return;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      societyId: true,
      totalTTC: true,
      status: true,
      stripePaymentPaidAt: true,
      payments: { select: { amount: true } },
    },
  });
  if (!invoice) return;
  if (invoice.stripePaymentPaidAt) return; // Idempotent

  const amountCents = session.amount_total ?? 0;
  const amount = amountCents / 100;

  // Enregistrer le Payment et marquer la facture
  const paidNow = invoice.payments.reduce((s, p) => s + p.amount, 0) + amount;
  const isFullyPaid = paidNow >= invoice.totalTTC - 0.01;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        paidAt: new Date(),
        method: "carte",
        reference: session.id,
        notes: `Paiement en ligne Stripe — session ${session.id}`,
        isReconciled: false,
      },
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        stripePaymentPaidAt: new Date(),
        status: isFullyPaid ? "PAYE" : "PARTIELLEMENT_PAYE",
      },
    }),
  ]);
}

async function handleAccountUpdated(account: Stripe.Account) {
  const society = await prisma.society.findFirst({
    where: { stripeConnectId: account.id },
    select: { id: true },
  });
  if (!society) return;
  const status = account.charges_enabled && account.payouts_enabled ? "active" : "pending";
  await prisma.society.update({
    where: { id: society.id },
    data: { stripeConnectStatus: status },
  });
}

async function handleAccountDeauthorized(stripeAccountId: string | null | undefined) {
  if (!stripeAccountId) return;
  const society = await prisma.society.findFirst({
    where: { stripeConnectId: stripeAccountId },
    select: { id: true },
  });
  if (!society) return;
  await prisma.society.update({
    where: { id: society.id },
    data: {
      stripeConnectId: null,
      stripeConnectStatus: null,
      stripeConnectAt: null,
    },
  });
}
