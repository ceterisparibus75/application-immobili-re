/**
 * Gestion des tokens OAuth 2.1 SUPER PDP par société.
 *
 * SUPER PDP impose la rotation du refresh token à chaque usage (OAuth 2.1).
 * → Après chaque refresh, le nouveau refresh_token DOIT être stocké immédiatement.
 *
 * Flux : Authorization Code + PKCE (un token par société cliente).
 * Endpoints SUPER PDP :
 *   Authorization : https://api.superpdp.tech/oauth2/authorize
 *   Token         : https://api.superpdp.tech/oauth2/token
 *   Révocation    : https://api.superpdp.tech/oauth2/revoke
 */

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Lecture du token (avec refresh automatique)
// ---------------------------------------------------------------------------

/**
 * Retourne le access token SUPER PDP de la société, en le rafraîchissant
 * si nécessaire. Retourne null si la société n'est pas connectée.
 */
export async function getSocietyAccessToken(societyId: string): Promise<string | null> {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: {
      paOAuthAccessToken: true,
      paOAuthRefreshToken: true,
      paOAuthTokenExpiresAt: true,
    },
  });

  if (!society?.paOAuthAccessToken) return null;

  const expiresAt = society.paOAuthTokenExpiresAt;
  const isExpired = !expiresAt || expiresAt < new Date(Date.now() + 60_000); // marge 1 min

  if (!isExpired) {
    return decrypt(society.paOAuthAccessToken);
  }

  // Token expiré → refresh
  if (!society.paOAuthRefreshToken) {
    await _clearSocietyTokens(societyId);
    return null;
  }

  return _refreshSocietyToken(societyId, decrypt(society.paOAuthRefreshToken));
}

// ---------------------------------------------------------------------------
// Stockage des tokens
// ---------------------------------------------------------------------------

export async function storeSocietyTokens(
  societyId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number
): Promise<void> {
  await prisma.society.update({
    where: { id: societyId },
    data: {
      paOAuthAccessToken: encrypt(accessToken),
      paOAuthRefreshToken: refreshToken ? encrypt(refreshToken) : null,
      paOAuthTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });
}

// ---------------------------------------------------------------------------
// Déconnexion (révocation + suppression)
// ---------------------------------------------------------------------------

export async function disconnectSocietyFromSuperPDP(societyId: string): Promise<void> {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { paOAuthRefreshToken: true, paOAuthAccessToken: true },
  });

  if (society?.paOAuthRefreshToken && env.PA_AUTH_TOKEN_URL) {
    const revokeUrl = env.PA_AUTH_TOKEN_URL.replace("/token", "/revoke");
    await fetch(revokeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: decrypt(society.paOAuthRefreshToken),
        token_type_hint: "refresh_token",
        client_id: env.PA_AUTH_CLIENT_ID ?? "",
        client_secret: env.PA_AUTH_CLIENT_SECRET ?? "",
      }),
    }).catch(() => {}); // best-effort — on supprime localement même si la révocation échoue
  }

  await _clearSocietyTokens(societyId);
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

async function _refreshSocietyToken(societyId: string, refreshToken: string): Promise<string | null> {
  if (!env.PA_AUTH_TOKEN_URL || !env.PA_AUTH_CLIENT_ID || !env.PA_AUTH_CLIENT_SECRET) {
    return null;
  }

  const res = await fetch(env.PA_AUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.PA_AUTH_CLIENT_ID,
      client_secret: env.PA_AUTH_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    // Refresh token révoqué ou expiré → déconnecter la société
    await _clearSocietyTokens(societyId);
    return null;
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string; // OAuth 2.1 : rotation obligatoire à chaque usage
    expires_in?: number;
  };

  await storeSocietyTokens(
    societyId,
    data.access_token,
    data.refresh_token ?? refreshToken, // conserver l'ancien si la PA ne retourne pas de nouveau RT
    data.expires_in ?? 3600
  );

  return data.access_token;
}

async function _clearSocietyTokens(societyId: string): Promise<void> {
  await prisma.society.update({
    where: { id: societyId },
    data: {
      paOAuthAccessToken: null,
      paOAuthRefreshToken: null,
      paOAuthTokenExpiresAt: null,
    },
  });
}

// ---------------------------------------------------------------------------
// Nettoyage des états PKCE expirés (appelé périodiquement depuis authorize)
// ---------------------------------------------------------------------------

export async function cleanupExpiredOAuthStates(): Promise<void> {
  await prisma.pAOAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
