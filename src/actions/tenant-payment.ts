"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  buildConnectOAuthUrl,
  createInvoiceCheckoutSession,
  deauthorizeConnectAccount,
  isStripeConnectConfigured,
  retrieveConnectAccount,
} from "@/lib/stripe-connect";
import { randomBytes } from "node:crypto";

// ─── Types publics ─────────────────────────────────────────────────────────

export type StripeConnectStatus =
  | "not_configured"
  | "not_connected"
  | "pending"
  | "active"
  | "disabled";

export interface StripeConnectOverview {
  status: StripeConnectStatus;
  accountId: string | null;
  connectedAt: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  serviceConfigured: boolean;
}

// ─── Lecture du statut ─────────────────────────────────────────────────────

export async function getStripeConnectOverview(
  societyId: string
): Promise<ActionResult<StripeConnectOverview>> {
  try {
    await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { stripeConnectId: true, stripeConnectStatus: true, stripeConnectAt: true },
    });
    if (!society) return { success: false, error: "Société introuvable" };

    const serviceConfigured = isStripeConnectConfigured();
    if (!society.stripeConnectId) {
      return {
        success: true,
        data: {
          status: serviceConfigured ? "not_connected" : "not_configured",
          accountId: null,
          connectedAt: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          serviceConfigured,
        },
      };
    }

    // Interroger Stripe pour l'état réel (charges/payouts) — fail-safe si down
    let chargesEnabled = false;
    let payoutsEnabled = false;
    let detailsSubmitted = false;
    let status: StripeConnectStatus = "pending";
    try {
      const account = await retrieveConnectAccount(society.stripeConnectId);
      chargesEnabled = Boolean(account.charges_enabled);
      payoutsEnabled = Boolean(account.payouts_enabled);
      detailsSubmitted = Boolean(account.details_submitted);
      status = chargesEnabled && payoutsEnabled ? "active" : "pending";
    } catch (err) {
      console.warn("[getStripeConnectOverview] retrieveConnectAccount", err);
      status = (society.stripeConnectStatus as StripeConnectStatus | null) ?? "pending";
    }

    return {
      success: true,
      data: {
        status,
        accountId: society.stripeConnectId,
        connectedAt: society.stripeConnectAt?.toISOString() ?? null,
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
        serviceConfigured,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getStripeConnectOverview]", error);
    return { success: false, error: "Erreur lors de la récupération du statut" };
  }
}

// ─── Démarrage de la connexion OAuth ───────────────────────────────────────

export async function startStripeConnectOAuth(
  societyId: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");
    if (!isStripeConnectConfigured()) {
      return { success: false, error: "Le paiement en ligne n'est pas configuré côté serveur." };
    }

    // Signature du state pour vérifier au retour : encode societyId + userId + nonce.
    // Le nonce vient de crypto pour éviter la reuse.
    const nonce = randomBytes(16).toString("hex");
    const state = `${societyId}.${context.userId}.${nonce}`;
    const appUrl = env.AUTH_URL ?? "https://app.mygestia.immo";
    const redirectUri = `${appUrl}/api/stripe/connect/callback`;

    const url = buildConnectOAuthUrl(state, redirectUri);

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Society",
      entityId: societyId,
      details: { action: "stripe_connect_oauth_started" },
    });

    return { success: true, data: { url } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[startStripeConnectOAuth]", error);
    return { success: false, error: "Erreur lors de la préparation de la connexion" };
  }
}

// ─── Déconnexion ───────────────────────────────────────────────────────────

export async function disconnectStripeConnect(societyId: string): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { stripeConnectId: true },
    });
    if (!society?.stripeConnectId) {
      return { success: true }; // Idempotent
    }

    try {
      await deauthorizeConnectAccount(society.stripeConnectId);
    } catch (err) {
      // Non bloquant : le compte peut avoir déjà révoqué côté Stripe.
      console.warn("[disconnectStripeConnect] deauthorize", err);
    }

    await prisma.society.update({
      where: { id: societyId },
      data: {
        stripeConnectId: null,
        stripeConnectStatus: null,
        stripeConnectAt: null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Society",
      entityId: societyId,
      details: { action: "stripe_connect_disconnected" },
    });

    revalidatePath("/parametres/facturation");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[disconnectStripeConnect]", error);
    return { success: false, error: "Erreur lors de la déconnexion" };
  }
}

// ─── Génération d'un lien de paiement pour une facture ─────────────────────

export async function createInvoicePaymentLink(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ url: string; sessionId: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const [invoice, society] = await Promise.all([
      prisma.invoice.findFirst({
        where: { id: invoiceId, societyId },
        select: {
          id: true,
          invoiceNumber: true,
          totalTTC: true,
          status: true,
          stripePaymentUrl: true,
          stripePaymentPaidAt: true,
          tenant: { select: { email: true } },
          payments: { select: { amount: true } },
        },
      }),
      prisma.society.findUnique({
        where: { id: societyId },
        select: {
          stripeConnectId: true,
          stripeConnectStatus: true,
          name: true,
        },
      }),
    ]);

    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (!society?.stripeConnectId) {
      return { success: false, error: "Cette société n'a pas connecté son compte Stripe." };
    }
    if (invoice.stripePaymentPaidAt) {
      return { success: false, error: "Cette facture a déjà été payée en ligne." };
    }
    if (invoice.status === "PAYE" || invoice.status === "ANNULEE") {
      return { success: false, error: "Cette facture ne peut plus être payée." };
    }

    // Réutiliser le lien existant s'il est encore ouvert (idempotent), sinon recréer
    if (invoice.stripePaymentUrl) {
      return {
        success: true,
        data: { url: invoice.stripePaymentUrl, sessionId: "" },
      };
    }

    // Montant restant dû
    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, invoice.totalTTC - paid);
    if (remaining <= 0) {
      return { success: false, error: "Aucun montant à payer." };
    }

    const appUrl = env.AUTH_URL ?? "https://app.mygestia.immo";
    const description = `Facture ${invoice.invoiceNumber ?? invoice.id} — ${society.name}`;

    const { id: sessionId, url } = await createInvoiceCheckoutSession({
      stripeAccountId: society.stripeConnectId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      tenantEmail: invoice.tenant?.email ?? null,
      amountCents: Math.round(remaining * 100),
      currency: "eur",
      description,
      successUrl: `${appUrl}/portal/paiement-success?invoice=${invoice.id}`,
      cancelUrl: `${appUrl}/portal/paiement-annule?invoice=${invoice.id}`,
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        stripeCheckoutSessionId: sessionId,
        stripePaymentUrl: url,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoice.id,
      details: { action: "stripe_payment_link_created", amount: remaining },
    });

    revalidatePath(`/facturation/${invoice.id}`);

    return { success: true, data: { url, sessionId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createInvoicePaymentLink]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la création du lien",
    };
  }
}
