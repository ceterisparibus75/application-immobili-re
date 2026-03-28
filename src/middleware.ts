import { randomBytes } from "crypto";
import type { Ratelimit } from "@upstash/ratelimit";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Routes publiques - pas de verification
  if (
    pathname.startsWith("/locaux") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/mentions-legales") ||
    pathname.startsWith("/politique-confidentialite") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/admin/migrate") ||
    pathname.startsWith("/api/dataroom") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/dataroom") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Portail locataire - auth geree par JWT portail, pas NextAuth
  if (pathname.startsWith("/portal") || pathname.startsWith("/api/portal")) {
    return NextResponse.next();
  }

  // Pages de login - rediriger si deja connecte (sauf si 2FA requis)
  if (pathname === "/login" || pathname === "/forgot-password") {
    if (req.auth) {
      const authData = req.auth as { requires2FA?: boolean; twoFactorVerified?: boolean };
      // Si 2FA requis, laisser passer pour ne pas bloquer le flux
      if (authData.requires2FA && !authData.twoFactorVerified) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Page 2FA - accessible uniquement si session partielle avec 2FA requis
  if (pathname.startsWith("/login/two-factor")) {
    if (!req.auth) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (!(req.auth as { requires2FA?: boolean }).requires2FA) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Rate limiting (actif si Upstash configure)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { getLoginRatelimit, getApiRatelimit } = await import("@/lib/rate-limit");
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      `anon-${crypto.randomUUID()}`;
    let limiter: Ratelimit | undefined;
    if (pathname === "/login" || pathname.startsWith("/api/auth") || pathname === "/login/two-factor") {
      limiter = getLoginRatelimit();
    } else if (pathname.startsWith("/api/")) {
      limiter = getApiRatelimit();
    }
    if (limiter) {
      const { success, reset } = await limiter.limit(ip);
      if (!success) {
        const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
        return new Response(
          JSON.stringify({ error: { code: "RATE_LIMIT", message: "Trop de requetes. Reessayez dans quelques secondes." } }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfterSeconds),
            },
          }
        );
      }
    }
  }

  // Toutes les autres routes : authentification requise
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verifier si 2FA est requis et non encore verifie
  const authData = req.auth as { requires2FA?: boolean; twoFactorVerified?: boolean };
  if (authData.requires2FA && !authData.twoFactorVerified) {
    if (!pathname.startsWith("/login/two-factor")) {
      return NextResponse.redirect(new URL("/login/two-factor", req.url));
    }
    return NextResponse.next();
  }

  // Lire la societe active depuis le cookie
  const activeSocietyId = req.cookies.get("active-society-id")?.value;

  // Generer un nonce unique par requete pour Content-Security-Policy
  const nonce = randomBytes(16).toString("base64");
  const cspValue = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // Injecter les headers dans la reponse
  const response = NextResponse.next();
  if (activeSocietyId) {
    response.headers.set("x-society-id", activeSocietyId);
  }
  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", cspValue);

  return response;
});

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - _next/static, _next/image
     * - favicon.ico, sitemap.xml, robots.txt
     * - fichiers statiques (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
