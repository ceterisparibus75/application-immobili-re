import { NextRequest, NextResponse } from "next/server";
import { consumePortalMagicLink } from "@/lib/portal-magic-link";
import { createPortalSession } from "@/lib/portal-auth";
import { env } from "@/lib/env";
import { enforceWebhookRateLimit } from "@/lib/webhook-rate-limit";

/**
 * GET /api/portal/magic/[token]
 *
 * Consomme un magic link à usage unique et crée la session portail JWT.
 * Redirige ensuite vers /portal (tableau de bord locataire).
 *
 * En cas d'échec (token inconnu, expiré, déjà utilisé) → redirige vers
 * /portal/login avec un flash message.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limit léger — 20 req/10s par IP (typique pour un lien cliqué).
  const rate = await enforceWebhookRateLimit(req, "portal-magic");
  if (rate) return rate;

  const { token } = await params;
  const baseUrl = env.AUTH_URL ?? new URL(req.url).origin;

  if (!token || token.length < 32) {
    return NextResponse.redirect(`${baseUrl}/portal/login?reason=invalid_link`);
  }

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent");

  const identity = await consumePortalMagicLink(token, { ipAddress, userAgent });
  if (!identity) {
    return NextResponse.redirect(`${baseUrl}/portal/login?reason=expired_link`);
  }

  // La session portail est identifiée par tenantId + email connecté :
  //  - Si mandataire  : email = mandataireEmail (traçabilité)
  //  - Sinon (tenant) : email = tenantEmail
  const sessionEmail = identity.mandataireEmail ?? identity.tenantEmail;
  await createPortalSession(identity.tenantId, sessionEmail);

  return NextResponse.redirect(`${baseUrl}/portal`);
}
