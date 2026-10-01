import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Amorçage du cookie `active-society-id` lors de la toute première
 * connexion d'un utilisateur, OU quand le cookie a été perdu / effacé.
 *
 * Problème initial : la layout (app) calcule bien la société active côté
 * serveur, mais elle ne peut pas poser de cookie depuis un Server Component.
 * Le `SocietyProvider` le pose côté client, mais trop tard : les pages
 * server (/dashboard, /facturation, …) lisent `headers().get("x-society-id")`
 * injecté par le middleware depuis le cookie — qui est absent au tout
 * premier rendu. Elles redirigent alors vers /login → boucle.
 *
 * Cette route s'occupe de poser le cookie en 302, puis redirige vers la
 * destination d'origine (`?redirect=/dashboard` par défaut).
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Destination finale : accepte uniquement un chemin interne commençant par "/"
  // (pas d'URL absolue — évite une open redirect).
  const requestedRedirect = request.nextUrl.searchParams.get("redirect");
  const safeRedirect =
    requestedRedirect && requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/dashboard";

  // Préférer une société dont l'utilisateur est owner, sinon la 1re
  // membership par date de création (cohérent avec getSocieties()).
  const owned = await prisma.userSociety.findFirst({
    where: { userId: session.user.id, society: { ownerId: session.user.id } },
    orderBy: { createdAt: "asc" },
    select: { societyId: true },
  });
  const fallback = owned
    ? null
    : await prisma.userSociety.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { societyId: true },
      });
  const societyId = owned?.societyId ?? fallback?.societyId ?? null;

  if (!societyId) {
    // Pas de société du tout — laisser la layout gérer (redirect /proprietaire/setup).
    return NextResponse.redirect(new URL(safeRedirect, request.url));
  }

  const response = NextResponse.redirect(new URL(safeRedirect, request.url));
  response.cookies.set("active-society-id", societyId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: true,
    httpOnly: false, // le SocietyProvider le lit côté client aussi
  });
  return response;
}
