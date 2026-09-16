import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash, compare } from "bcryptjs";
import { randomInt } from "crypto";
import { createPortalSession } from "@/lib/portal-auth";
import { portalLoginRequestSchema, portalLoginVerifySchema } from "@/validations/portal";
import { sendPortalLoginCodeEmail } from "@/lib/email";
import { getPortalRatelimit } from "@/lib/rate-limit";

/**
 * Résout un email portail vers un tenant + éventuel mandataire.
 *
 * Cherche dans 3 sources, dans l'ordre :
 *  1. Tenant.email            (locataire principal)
 *  2. Tenant.billingEmail     (email de facturation dédié)
 *  3. TenantMandataire.email  (comptable, gérant… avec canAccessPortal=true)
 *
 * Retourne le premier match trouvé. Si l'email est mandataire de plusieurs
 * locataires, on prend le premier avec un portail actif (rare — un mandataire
 * gère typiquement un tenant à la fois côté MyGestia).
 */
async function resolvePortalIdentity(rawEmail: string) {
  const email = rawEmail.toLowerCase().trim();

  // 1 + 2. Locataire principal (email ou billingEmail)
  const tenants = await prisma.tenant.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        { billingEmail: { equals: email, mode: "insensitive" } },
      ],
    },
    include: { portalAccess: true },
  });
  const tenant = tenants.find((t) => t.portalAccess?.isActive) ?? tenants[0];
  if (tenant?.portalAccess?.isActive) {
    return { kind: "tenant" as const, tenant, mandataire: null };
  }

  // 3. Mandataire (comptable, gérant…)
  const mandataires = await prisma.tenantMandataire.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      canAccessPortal: true,
      tenant: { isActive: true, deletedAt: null },
    },
    include: {
      tenant: { include: { portalAccess: true } },
    },
  });
  const mandataire =
    mandataires.find((m) => m.tenant.portalAccess?.isActive) ?? mandataires[0];
  if (mandataire?.tenant.portalAccess?.isActive) {
    return { kind: "mandataire" as const, tenant: mandataire.tenant, mandataire };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Rate limiting (par IP)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "127.0.0.1";
    const limiter = getPortalRatelimit();
    const { success: rateLimitOk } = await limiter.limit(ip);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans quelques minutes." },
        { status: 429 }
      );
    }

    // ── Étape 2 : vérification du code ───────────────────────────────
    if (body.code) {
      const parsed = portalLoginVerifySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors.map((e) => e.message).join(", ") },
          { status: 400 }
        );
      }

      const { email, code } = parsed.data;
      const identity = await resolvePortalIdentity(email);

      if (!identity?.tenant.portalAccess?.isActive) {
        return NextResponse.json({ error: "Compte portail introuvable ou inactif" }, { status: 404 });
      }

      const portal = identity.tenant.portalAccess;

      if (portal.activationCodeExpiresAt && new Date() > portal.activationCodeExpiresAt) {
        const dummyHash = "$2b$10$dummyhashvaluefortimingattttttttttttttttttttttt";
        await compare(code, dummyHash);
        return NextResponse.json({ error: "Code expiré. Redemandez un code." }, { status: 400 });
      }

      const dummyHash = "$2b$10$dummyhashvaluefortimingattttttttttttttttttttttt";
      const hashToCompare = portal.activationCode ?? dummyHash;
      const isValid = await compare(code, hashToCompare);
      if (!portal.activationCode || !isValid) {
        return NextResponse.json({ error: "Code invalide" }, { status: 400 });
      }

      // Code valide → nettoyer + tracer login
      await prisma.tenantPortalAccess.update({
        where: { id: portal.id },
        data: {
          activationCode: null,
          activationCodeExpiresAt: null,
          lastLoginAt: new Date(),
        },
      });
      if (identity.kind === "mandataire" && identity.mandataire) {
        await prisma.tenantMandataire.update({
          where: { id: identity.mandataire.id },
          data: { lastLoginAt: new Date() },
        });
      }

      // La session porte l'email qui s'est réellement connecté (mandataire
      // ou tenant) mais reste scopée sur tenantId — le portail affiche
      // toujours les données du locataire, avec traçabilité de qui a agi.
      await createPortalSession(identity.tenant.id, email);
      return NextResponse.json({ success: true });
    }

    // ── Étape 1 : envoi du code ──────────────────────────────────────
    const parsed = portalLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const identity = await resolvePortalIdentity(email);

    if (!identity?.tenant.portalAccess?.isActive) {
      // Ne pas révéler si le compte existe ou non
      return NextResponse.json({ codeSent: true });
    }

    // Générer un code de connexion (15 min)
    const loginCode = String(randomInt(100000, 999999));
    const hashedCode = await hash(loginCode, 10);

    await prisma.tenantPortalAccess.update({
      where: { id: identity.tenant.portalAccess.id },
      data: {
        activationCode: hashedCode,
        activationCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const tenant = identity.tenant;
    const tenantName =
      tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();

    // ⚠️ Envoyer le code à l'email qui a fait la demande (pas forcément
    // le tenant principal) : sinon un mandataire ne recevrait jamais le
    // code alors qu'il en a besoin pour se connecter.
    await sendPortalLoginCodeEmail({
      to: email,
      tenantName,
      code: loginCode,
    });

    return NextResponse.json({ codeSent: true });
  } catch (error) {
    console.error("[portal/login]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
