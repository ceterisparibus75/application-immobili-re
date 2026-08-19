import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSuperAdmin, ForbiddenError } from "@/lib/permissions";
import { env } from "@/lib/env";

/**
 * Endpoint diagnostic — état de la configuration facturation électronique
 * sans révéler les secrets.
 *
 * Réservé aux SUPER_ADMIN. Affiche :
 *   - Présence / absence de chaque env var PA_*
 *   - Preview partiel des identifiants (préfixe + suffixe, milieu masqué)
 *   - Hostname des URLs (permet de vérifier prod vs sandbox)
 *   - AUTH_URL complet (pas un secret)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    await requireSuperAdmin(session.user.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Accès SUPER_ADMIN requis" }, { status: 403 });
    }
    throw err;
  }

  function maskSecret(v: string | undefined): string {
    if (!v) return "(non défini)";
    if (v.length <= 12) return `${v.slice(0, 3)}****${v.slice(-2)} (len=${v.length})`;
    return `${v.slice(0, 8)}****${v.slice(-4)} (len=${v.length})`;
  }
  function hostname(v: string | undefined): string {
    if (!v) return "(non défini)";
    try {
      const u = new URL(v);
      return `${u.protocol}//${u.host}${u.pathname}`;
    } catch {
      return `(URL invalide: ${v})`;
    }
  }

  const authUrl = env.AUTH_URL ?? "(non défini)";
  const redirectUri = env.AUTH_URL
    ? `${env.AUTH_URL}/api/einvoicing/oauth/callback`
    : "(non calculable — AUTH_URL manquant)";

  return NextResponse.json({
    computedAt: new Date().toISOString(),
    facturationElectronique: {
      PA_AUTH_CLIENT_ID: maskSecret(env.PA_AUTH_CLIENT_ID),
      PA_AUTH_CLIENT_SECRET: env.PA_AUTH_CLIENT_SECRET ? "***** (défini)" : "(non défini)",
      PA_OAUTH_AUTHORIZE_URL: hostname(env.PA_OAUTH_AUTHORIZE_URL),
      PA_AUTH_TOKEN_URL: hostname(env.PA_AUTH_TOKEN_URL),
      PA_API_BASE_URL: hostname(env.PA_API_BASE_URL),
      PA_MANDATAIRE_SIRET: env.PA_MANDATAIRE_SIRET ?? "(non défini)",
      PA_API_KEY: env.PA_API_KEY ? "***** (défini)" : "(non défini)",
    },
    authApp: {
      AUTH_URL: authUrl,
      redirectUri_envoyé_à_SUPER_PDP: redirectUri,
    },
    superPdpAppExpected: {
      client_id_à_matcher: "019dc8ec-5975-7ae3-af9a-8424af0ec1f3",
      redirect_uri_à_matcher: "https://app.mygestia.immo/api/einvoicing/oauth/callback",
      note: "Le PA_AUTH_CLIENT_ID Vercel et l'AUTH_URL doivent produire ces valeurs.",
    },
  });
}
