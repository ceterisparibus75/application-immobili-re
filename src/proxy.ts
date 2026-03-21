import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Routes publiques — pas de vérification
  if (
    pathname.startsWith("/locaux") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/mentions-legales") ||
    pathname.startsWith("/politique-confidentialite") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Portail locataire — vérification du token dans l'URL (géré par la page)
  if (pathname.startsWith("/portal")) {
    return NextResponse.next();
  }

  // Pages de login — rediriger si déjà connecté
  if (pathname === "/login" || pathname === "/forgot-password") {
    if (req.auth) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Toutes les autres routes : authentification requise
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Lire la société active depuis le cookie
  const activeSocietyId = req.cookies.get("active-society-id")?.value;

  // Injecter le societyId dans les headers pour les Server Components
  const response = NextResponse.next();
  if (activeSocietyId) {
    response.headers.set("x-society-id", activeSocietyId);
  }

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
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
