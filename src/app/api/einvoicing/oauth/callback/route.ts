/**
 * GET /api/einvoicing/oauth/callback?code=xxx&state=xxx
 *
 * Callback OAuth 2.1 SUPER PDP — échange le code d'autorisation contre des tokens,
 * les chiffre (AES-256-GCM) et les stocke dans la société concernée.
 *
 * state = identifiant opaque aléatoire généré dans l'authorize, lié à
 *         { userId, societyId, codeVerifier } via PAOAuthState. Vérifié
 *         contre la session NextAuth pour empêcher qu'un autre utilisateur
 *         finalise l'OAuth d'une société qu'il ne possède pas.
 *
 * Après succès, redirige vers /parametres/facturation?pa_connected=true
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeSocietyTokens } from "@/lib/pa-oauth";
import { env } from "@/lib/env";

const SETTINGS_URL = "/parametres/facturation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error("[oauth/callback] Erreur SUPER PDP:", error, errorDescription);
    return NextResponse.redirect(
      `${env.AUTH_URL}${SETTINGS_URL}?pa_error=${encodeURIComponent(errorDescription ?? error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${env.AUTH_URL}${SETTINGS_URL}?pa_error=missing_params`);
  }

  // Charger l'état OAuth par son state opaque (single-use, expiration 10 min).
  const oauthState = await prisma.pAOAuthState.findUnique({
    where: { state },
  });

  if (!oauthState || oauthState.expiresAt < new Date()) {
    return NextResponse.redirect(`${env.AUTH_URL}${SETTINGS_URL}?pa_error=expired_state`);
  }

  // Vérifier que la session active correspond à l'utilisateur ayant initié
  // l'authorize. Empêche un autre utilisateur authentifié de finaliser
  // l'OAuth sur une société qu'il ne possède pas (CSRF / fixation).
  const session = await auth();
  if (!session?.user?.id || session.user.id !== oauthState.userId) {
    console.warn(
      `[oauth/callback] User mismatch ou pas de session — state=${state} expectedUserId=${oauthState.userId} sessionUserId=${session?.user?.id ?? "none"}`
    );
    // Ne pas supprimer le state — laisser expirer naturellement.
    return NextResponse.redirect(`${env.AUTH_URL}${SETTINGS_URL}?pa_error=user_mismatch`);
  }

  const societyId = oauthState.societyId;

  // Supprimer l'état immédiatement (single-use)
  await prisma.pAOAuthState.delete({ where: { id: oauthState.id } });

  // Échanger le code contre des tokens
  if (!env.PA_AUTH_TOKEN_URL || !env.PA_AUTH_CLIENT_ID || !env.PA_AUTH_CLIENT_SECRET) {
    return NextResponse.redirect(`${env.AUTH_URL}${SETTINGS_URL}?pa_error=missing_config`);
  }

  const redirectUri = `${env.AUTH_URL}/api/einvoicing/oauth/callback`;

  const tokenRes = await fetch(env.PA_AUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env.PA_AUTH_CLIENT_ID,
      client_secret: env.PA_AUTH_CLIENT_SECRET,
      code_verifier: oauthState.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    console.error("[oauth/callback] Échange de token échoué", tokenRes.status, body);
    return NextResponse.redirect(
      `${env.AUTH_URL}${SETTINGS_URL}?pa_error=${encodeURIComponent("token_exchange_failed")}`
    );
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  // Chiffrer et stocker les tokens dans la société
  await storeSocietyTokens(
    societyId,
    tokens.access_token,
    tokens.refresh_token,
    tokens.expires_in ?? 3600
  );

  return NextResponse.redirect(`${env.AUTH_URL}${SETTINGS_URL}?pa_connected=true`);
}
