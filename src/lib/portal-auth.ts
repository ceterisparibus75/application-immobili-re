import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const PORTAL_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "portal-secret-fallback"
);
const COOKIE_NAME = "portal-token";
const TOKEN_EXPIRY = "24h";

interface PortalSession {
  tenantId: string;
}

/**
 * Crée un JWT pour une session portail locataire et le stocke en cookie.
 */
export async function createPortalSession(tenantId: string): Promise<void> {
  const token = await new SignJWT({ tenantId })
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

    return { tenantId: payload.tenantId };
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
