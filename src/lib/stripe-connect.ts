import Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

/**
 * Wrapper Stripe Connect Standard.
 *
 * Chaque société bailleur connecte son propre compte Stripe (personnel ou pro)
 * via OAuth. Les paiements des locataires arrivent directement chez le bailleur ;
 * MyGestia n'est que facilitateur (pas dépositaire), donc pas besoin d'agrément
 * PSAN. La Checkout Session est créée SUR le compte connecté (`stripeAccount`
 * dans les options d'appel).
 */

export function isStripeConnectConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_CONNECT_CLIENT_ID);
}

/**
 * URL d'OAuth pour connecter un compte Stripe existant à MyGestia.
 * Après validation Stripe, redirige vers /api/stripe/connect/callback avec ?code + ?state.
 */
export function buildConnectOAuthUrl(state: string, redirectUri: string): string {
  const clientId = env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new Error("STRIPE_CONNECT_CLIENT_ID est requis");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
    state,
    // Standard : le bailleur voit son dashboard Stripe et gère lui-même
    "stripe_user[business_type]": "individual",
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

/**
 * Échange un code OAuth contre un stripe_user_id (acct_xxx).
 * Utilisé dans le callback OAuth.
 */
export async function exchangeConnectOAuthCode(code: string): Promise<{
  stripeUserId: string;
  scope: string;
}> {
  const response = await getStripe().oauth.token({
    grant_type: "authorization_code",
    code,
  });
  if (!response.stripe_user_id) {
    throw new Error("Réponse Stripe OAuth invalide : stripe_user_id manquant");
  }
  return {
    stripeUserId: response.stripe_user_id,
    scope: response.scope ?? "read_write",
  };
}

/**
 * Déconnecte le compte connecté (révoque le token OAuth).
 * Le locataire ne pourra plus payer via ce compte tant qu'une nouvelle
 * connexion n'est pas établie.
 */
export async function deauthorizeConnectAccount(stripeAccountId: string): Promise<void> {
  const clientId = env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new Error("STRIPE_CONNECT_CLIENT_ID est requis");
  await getStripe().oauth.deauthorize({
    client_id: clientId,
    stripe_user_id: stripeAccountId,
  });
}

/**
 * Récupère l'état du compte connecté (charges_enabled, payouts_enabled).
 * Sert à afficher un statut précis dans l'UI (KYC en attente vs actif).
 */
export async function retrieveConnectAccount(stripeAccountId: string): Promise<Stripe.Account> {
  return getStripe().accounts.retrieve(stripeAccountId);
}

/**
 * Crée une Checkout Session PaymentIntent sur le compte connecté du bailleur.
 * Les fonds arrivent chez le bailleur, MyGestia ne prélève aucun fee ici.
 *
 * `stripeAccount` dans les options → l'API agit "au nom de" ce compte connecté.
 */
export async function createInvoiceCheckoutSession(params: {
  stripeAccountId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  tenantEmail: string | null;
  amountCents: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: params.currency,
            unit_amount: params.amountCents,
            product_data: {
              name: params.description,
              ...(params.invoiceNumber ? { metadata: { invoice_number: params.invoiceNumber } } : {}),
            },
          },
          quantity: 1,
        },
      ],
      customer_email: params.tenantEmail ?? undefined,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        mygestia_invoice_id: params.invoiceId,
        ...(params.invoiceNumber ? { mygestia_invoice_number: params.invoiceNumber } : {}),
      },
      payment_intent_data: {
        metadata: {
          mygestia_invoice_id: params.invoiceId,
          ...(params.invoiceNumber ? { mygestia_invoice_number: params.invoiceNumber } : {}),
        },
      },
    },
    {
      stripeAccount: params.stripeAccountId,
    }
  );
  if (!session.url) {
    throw new Error("Stripe n'a pas retourné d'URL de paiement");
  }
  return { id: session.id, url: session.url };
}
