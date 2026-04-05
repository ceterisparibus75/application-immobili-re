import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  throw new Error("AUTH_SECRET est requis pour l'authentification du portail");
}
const PORTAL_SECRET = new TextEncoder().encode(authSecret);
const COOKIE_NAME = "portal-token";
const TOKEN_EXPIRY = "24h";

interface PortalSession {
  tenantId: string;
  email: string;
}

/**
 * Crée un JWT pour une session portail locataire et le stocke en cookie.
 */
export async function createPortalSession(tenantId: string, email: string): Promise<void> {
  const token = await new SignJWT({ tenantId, email: email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("portal")
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(PORTAL_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60, // 24h
    path: "/",
  });
}

/**
 * Vérifie le JWT portail depuis les cookies.
 * Retourne la session ou null si invalide/absent.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, PORTAL_SECRET, {
      issuer: "portal",
    });

    if (!payload.tenantId || typeof payload.tenantId !== "string") return null;
    if (!payload.email || typeof payload.email !== "string") return null;

    return { tenantId: payload.tenantId, email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Exige une session portail valide. Throw si absent.
 */
export async function requirePortalAuth(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    throw new Error("Accès portail non autorisé");
  }
  return session;
}

/**
 * Supprime le cookie de session portail.
 */
export async function clearPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
