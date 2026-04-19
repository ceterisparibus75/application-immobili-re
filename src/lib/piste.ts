/**
 * Client OAuth2 PISTE (Plateforme d'Intermédiation des Services pour la
 * Transformation de l'État) — gateway DGFiP / AIFE
 *
 * Gère l'obtention et le cache des tokens d'accès (Bearer).
 * Les tokens sont valables 1 heure ; on les renouvelle 5 minutes avant expiration.
 *
 * Utilisation :
 *   const token = await getPisteToken();
 *   // → "eyJhbGc..."
 */

import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// URLs par environnement
// ---------------------------------------------------------------------------

const PISTE_URLS = {
  sandbox: {
    token: "https://sandbox-oauth.piste.gouv.fr/api/oauth/token",
    api: "https://sandbox-api.piste.gouv.fr",
  },
  production: {
    token: "https://oauth.piste.gouv.fr/api/oauth/token",
    api: "https://api.piste.gouv.fr",
  },
} as const;

// ---------------------------------------------------------------------------
// Cache token en mémoire (process-level, adapté pour Vercel Fluid Compute)
// ---------------------------------------------------------------------------

interface CachedToken {
  value: string;
  expiresAt: number; // timestamp ms
}

let _tokenCache: CachedToken | null = null;

// ---------------------------------------------------------------------------
// Obtenir un token (avec renouvellement automatique)
// ---------------------------------------------------------------------------

/**
 * Retourne un Bearer token PISTE valide.
 * Utilise le cache si le token existant expire dans plus de 5 minutes.
 *
 * @throws Error si PISTE_CLIENT_ID ou PISTE_CLIENT_SECRET manquant
 */
export async function getPisteToken(): Promise<string> {
  const now = Date.now();

  // Cache valide ?
  if (_tokenCache && _tokenCache.expiresAt > now + 5 * 60 * 1000) {
    return _tokenCache.value;
  }

  if (!env.PISTE_CLIENT_ID || !env.PISTE_CLIENT_SECRET) {
    throw new PisteError("PISTE_CLIENT_ID et PISTE_CLIENT_SECRET requis");
  }

  const pisteEnv = env.PISTE_ENV ?? "sandbox";
  const tokenUrl = PISTE_URLS[pisteEnv].token;

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.PISTE_CLIENT_ID,
      client_secret: env.PISTE_CLIENT_SECRET,
      scope: "openid",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PisteError(`Échec obtention token PISTE (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  _tokenCache = {
    value: data.access_token,
    // expires_in est en secondes, on soustrait 60s de marge
    expiresAt: now + (data.expires_in - 60) * 1000,
  };

  return _tokenCache.value;
}

/**
 * Invalide le cache (utile après une erreur 401 de l'API)
 */
export function invalidatePisteToken(): void {
  _tokenCache = null;
}

// ---------------------------------------------------------------------------
// Erreur typée
// ---------------------------------------------------------------------------

export class PisteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PisteError";
  }
}

// ---------------------------------------------------------------------------
// Vérifie que PISTE est configuré (utile pour les guards)
// ---------------------------------------------------------------------------

export function isPisteConfigured(): boolean {
  return !!(env.PISTE_CLIENT_ID && env.PISTE_CLIENT_SECRET);
}
