/**
 * GET /api/einvoicing/oauth/authorize?societyId=xxx
 *
 * Lance le flow OAuth 2.1 Authorization Code + PKCE vers SUPER PDP.
 * Redirige le navigateur de l'utilisateur vers la page d'autorisation SUPER PDP.
 *
 * Conditions :
 *   - PA_OAUTH_AUTHORIZE_URL configuré (https://api.superpdp.tech/oauth2/authorize)
 *   - PA_AUTH_CLIENT_ID configuré
 *   - L'utilisateur doit être ADMIN_SOCIETE de la société cible
 */

import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { randomPKCECodeVerifier, calculatePKCECodeChallenge } from "openid-client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { cleanupExpiredOAuthStates } from "@/lib/pa-oauth";
import { requireAuthenticatedRouteContext } from "@/lib/api-auth";
import { requireSocietyAccess } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  // Auth
  const authCtx = await requireAuthenticatedRouteContext();
  if (authCtx instanceof NextResponse) return authCtx;

  const { searchParams } = new URL(req.url);
  const societyId = searchParams.get("societyId");

  if (!societyId) {
    return NextResponse.json({ error: "societyId manquant" }, { status: 400 });
  }

  // Vérifier que l'utilisateur est admin de la société
  try {
    await requireSocietyAccess(authCtx.userId, societyId, "ADMIN_SOCIETE");
  } catch {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (!env.PA_OAUTH_AUTHORIZE_URL || !env.PA_AUTH_CLIENT_ID) {
    return NextResponse.json(
      { error: "OAuth SUPER PDP non configuré — renseignez PA_OAUTH_AUTHORIZE_URL et PA_AUTH_CLIENT_ID" },
      { status: 503 }
    );
  }

  // Nettoyage des états PKCE expirés (best-effort)
  cleanupExpiredOAuthStates().catch(() => {});

  // Générer les paramètres PKCE
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

  // State opaque aléatoire — lie le callback à cette session/société.
  const opaqueState = randomBytes(32).toString("hex");

  // Stocker le code_verifier + state + userId en DB (usage unique, expire dans 10 min)
  await prisma.pAOAuthState.create({
    data: {
      state: opaqueState,
      userId: authCtx.userId,
      societyId,
      codeVerifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const redirectUri = `${env.AUTH_URL}/api/einvoicing/oauth/callback`;

  const authUrl = new URL(env.PA_OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", env.PA_AUTH_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", opaqueState);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  // Scopes : aucun requis par SUPER PDP

  return NextResponse.redirect(authUrl.toString());
}
