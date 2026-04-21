/**
 * GET /api/einvoicing/oauth/callback?code=xxx&state=xxx
 *
 * Callback OAuth 2.1 SUPER PDP — échange le code d'autorisation contre des tokens,
 * les chiffre (AES-256-GCM) et les stocke dans la société concernée.
 *
 * state = societyId (passé dans l'authorize, retourné par SUPER PDP)
 *
 * Après succès, redirige vers /parametres/facturation?pa_connected=true
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeSocietyTokens } from "@/lib/pa-oauth";
import { env } from "@/lib/env";

const SETTINGS_URL = "/parametres/facturation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // societyId
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

  const societyId = state;

  // Récupérer et valider le code_verifier PKCE (usage unique)
  const oauthState = await prisma.pAOAuthState.findFirst({
    where: { societyId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
  });

  if (!oauthState) {
    return NextResponse.redirect(`${env.AUTH_URL}${SETTINGS_URL}?pa_error=expired_state`);
  }

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
