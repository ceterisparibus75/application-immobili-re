import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash, compare } from "bcryptjs";
import { randomInt } from "crypto";
import { createPortalSession } from "@/lib/portal-auth";
import { portalLoginRequestSchema, portalLoginVerifySchema } from "@/validations/portal";
import { sendPortalLoginCodeEmail } from "@/lib/email";
import { getPortalRatelimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Rate limiting sur le portail (par IP)
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

    // Si un code est fourni → étape 2 (vérification)
    if (body.code) {
      const parsed = portalLoginVerifySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors.map((e) => e.message).join(", ") },
          { status: 400 }
        );
      }

      const { email, code } = parsed.data;

      // Recherche multi-société : trouver tous les locataires avec cet email
      const tenants = await prisma.tenant.findMany({
        where: { email: { equals: email, mode: "insensitive" }, isActive: true },
        include: { portalAccess: true },
      });

      // Trouver celui avec un code d'activation en attente, sinon un portail actif
      const tenant = tenants.find((t) => t.portalAccess?.activationCode) ?? tenants.find((t) => t.portalAccess?.isActive);

      if (!tenant?.portalAccess?.isActive) {
        return NextResponse.json({ error: "Compte portail introuvable ou inactif" }, { status: 404 });
      }

      const portal = tenant.portalAccess;

      if (portal.activationCodeExpiresAt && new Date() > portal.activationCodeExpiresAt) {
        // Still run bcrypt to avoid timing leak on expiry check
        const dummyHash = "$2b$10$dummyhashvaluefortimingattttttttttttttttttttttt";
        await compare(code, dummyHash);
        return NextResponse.json({ error: "Code expiré. Redemandez un code." }, { status: 400 });
      }

      // Constant-time comparison: always run bcrypt even if no code exists
      const dummyHash = "$2b$10$dummyhashvaluefortimingattttttttttttttttttttttt";
      const hashToCompare = portal.activationCode ?? dummyHash;
      const isValid = await compare(code, hashToCompare);
      if (!portal.activationCode || !isValid) {
        return NextResponse.json({ error: "Code invalide" }, { status: 400 });
      }

      // Code valide → créer session
      await prisma.tenantPortalAccess.update({
        where: { id: portal.id },
        data: {
          activationCode: null,
          activationCodeExpiresAt: null,
          lastLoginAt: new Date(),
        },
      });

      await createPortalSession(tenant.id, email);
      return NextResponse.json({ success: true });
    }

    // Sinon → étape 1 (envoi du code)
    const parsed = portalLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Recherche multi-société : trouver tous les locataires avec cet email
    const tenants = await prisma.tenant.findMany({
      where: { email: { equals: email, mode: "insensitive" }, isActive: true },
      include: { portalAccess: true },
    });

    // Trouver un locataire avec un portail actif
    const tenant = tenants.find((t) => t.portalAccess?.isActive);

    if (!tenant?.portalAccess?.isActive) {
      // Ne pas révéler si le compte existe ou non
      return NextResponse.json({ codeSent: true });
    }

    // Générer un code de connexion (15 min)
    const loginCode = String(randomInt(100000, 999999));
    const hashedCode = await hash(loginCode, 10);

    await prisma.tenantPortalAccess.update({
      where: { id: tenant.portalAccess.id },
      data: {
        activationCode: hashedCode,
        activationCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const tenantName =
      tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();

    await sendPortalLoginCodeEmail({
      to: tenant.email,
      tenantName,
      code: loginCode,
    });

    return NextResponse.json({ codeSent: true });
  } catch (error) {
    console.error("[portal/login]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
