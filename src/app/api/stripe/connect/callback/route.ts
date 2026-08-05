import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { exchangeConnectOAuthCode, retrieveConnectAccount } from "@/lib/stripe-connect";
import { requireSocietyAccess } from "@/lib/permissions";

/**
 * Callback OAuth Stripe Connect.
 *
 * Flow :
 * 1. L'utilisateur clique "Connecter Stripe" dans /parametres/facturation
 * 2. Il est redirigé vers l'autorisation Stripe
 * 3. Stripe le renvoie ici avec ?code + ?state
 * 4. On échange le code contre un stripe_user_id (acct_xxx)
 * 5. On associe l'account à la société (state contient societyId.userId.nonce)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // L'utilisateur peut annuler la connexion depuis Stripe
  if (errorParam) {
    return redirectWithFlash("annule", `Connexion annulée : ${searchParams.get("error_description") ?? errorParam}`);
  }
  if (!code || !state) {
    return redirectWithFlash("erreur", "Paramètres OAuth manquants");
  }

  // State format : societyId.userId.nonce
  const parts = state.split(".");
  if (parts.length !== 3) {
    return redirectWithFlash("erreur", "État OAuth invalide");
  }
  const [societyId, expectedUserId] = parts;

  // Vérifier que la session utilisateur correspond au state
  const session = await auth();
  if (!session?.user?.id || session.user.id !== expectedUserId) {
    return redirectWithFlash("erreur", "Session incohérente — reconnectez-vous et réessayez");
  }

  try {
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");
  } catch {
    return redirectWithFlash("erreur", "Accès société refusé");
  }

  try {
    const { stripeUserId } = await exchangeConnectOAuthCode(code);

    // Récupérer l'état initial du compte pour poser un statusRepresentatif
    let status = "pending";
    try {
      const account = await retrieveConnectAccount(stripeUserId);
      status = account.charges_enabled && account.payouts_enabled ? "active" : "pending";
    } catch {
      /* on tolère */
    }

    await prisma.society.update({
      where: { id: societyId },
      data: {
        stripeConnectId: stripeUserId,
        stripeConnectStatus: status,
        stripeConnectAt: new Date(),
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Society",
      entityId: societyId,
      details: { action: "stripe_connect_completed", stripeUserId, status },
    });

    return redirectWithFlash("ok", "Compte Stripe connecté");
  } catch (error) {
    console.error("[stripe-connect callback]", error);
    return redirectWithFlash("erreur", "Échange OAuth échoué");
  }
}

function redirectWithFlash(status: "ok" | "erreur" | "annule", message: string): NextResponse {
  const params = new URLSearchParams({ stripe_connect: status, message });
  return NextResponse.redirect(
    new URL(`/parametres/facturation?${params.toString()}`, process.env.AUTH_URL ?? "http://localhost:3000")
  );
}
