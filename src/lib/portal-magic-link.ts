import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Magic link portail à usage unique.
 *
 * Un lien magic est un token cryptographique aléatoire (32 bytes hex = 64 chars)
 * qui permet à un locataire ou un de ses mandataires de se connecter au
 * portail sans saisir de code OTP. Injecté dans les emails automatiques
 * (facture, quittance, relance) pour simplifier l'accès.
 *
 * Sécurité :
 *  - Usage unique (usedAt posé à la première utilisation)
 *  - Expiration configurable (défaut : 7 jours)
 *  - IP + userAgent tracés à l'usage pour audit
 *  - Lié à un tenant OU à un mandataire (JWT session contient l'identité)
 */

const DEFAULT_TTL_DAYS = 7;

export async function generatePortalMagicLink(params: {
  tenantId: string;
  mandataireId?: string | null;
  ttlDays?: number;
}): Promise<{ url: string; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const ttl = params.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);

  await prisma.portalMagicLink.create({
    data: {
      tenantId: params.tenantId,
      mandataireId: params.mandataireId ?? null,
      token,
      expiresAt,
    },
  });

  const baseUrl = env.AUTH_URL ?? "https://app.mygestia.immo";
  const url = `${baseUrl}/api/portal/magic/${token}`;

  return { url, token, expiresAt };
}

/**
 * Valide et consomme un magic link. Renvoie l'identité résolue si valide.
 * `null` si token inconnu, expiré ou déjà utilisé.
 */
export async function consumePortalMagicLink(
  token: string,
  meta: { ipAddress?: string | null; userAgent?: string | null }
): Promise<{
  tenantId: string;
  tenantEmail: string;
  mandataireId: string | null;
  mandataireEmail: string | null;
} | null> {
  const link = await prisma.portalMagicLink.findUnique({
    where: { token },
    include: {
      tenant: { select: { id: true, email: true, isActive: true, deletedAt: true } },
      mandataire: { select: { id: true, email: true, canAccessPortal: true } },
    },
  });

  if (!link) return null;
  if (link.usedAt) return null;
  if (link.expiresAt < new Date()) return null;
  if (!link.tenant || !link.tenant.isActive || link.tenant.deletedAt) return null;
  if (link.mandataireId && (!link.mandataire || !link.mandataire.canAccessPortal)) return null;

  // Marquer utilisé (idempotent — pas de retry possible)
  await prisma.portalMagicLink.update({
    where: { id: link.id },
    data: {
      usedAt: new Date(),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    },
  });

  // Trace du login sur l'entité active
  if (link.mandataireId) {
    await prisma.tenantMandataire.update({
      where: { id: link.mandataireId },
      data: { lastLoginAt: new Date() },
    });
  } else {
    await prisma.tenantPortalAccess.updateMany({
      where: { tenantId: link.tenantId },
      data: { lastLoginAt: new Date() },
    });
  }

  return {
    tenantId: link.tenantId,
    tenantEmail: link.tenant.email,
    mandataireId: link.mandataireId,
    mandataireEmail: link.mandataire?.email ?? null,
  };
}

/** Purge des magic links expirés depuis + de 30 jours (best-effort). */
export async function cleanupExpiredMagicLinks(): Promise<void> {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.portalMagicLink
    .deleteMany({ where: { expiresAt: { lt: threshold } } })
    .catch((err) => {
      console.warn("[cleanupExpiredMagicLinks]", err);
    });
}
