import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash, compare } from "bcryptjs";
import { randomInt } from "crypto";
import { createPortalSession } from "@/lib/portal-auth";
import { portalLoginRequestSchema, portalLoginVerifySchema } from "@/validations/portal";
import { sendPortalLoginCodeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

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

      const tenant = await prisma.tenant.findFirst({
        where: { email, isActive: true },
        include: { portalAccess: true },
      });

      if (!tenant?.portalAccess?.isActive) {
        return NextResponse.json({ error: "Compte portail introuvable ou inactif" }, { status: 404 });
      }

      const portal = tenant.portalAccess;

      if (!portal.activationCode || !portal.activationCodeExpiresAt) {
        return NextResponse.json({ error: "Aucun code en attente. Redemandez un code." }, { status: 400 });
      }

      if (new Date() > portal.activationCodeExpiresAt) {
        return NextResponse.json({ error: "Code expiré. Redemandez un code." }, { status: 400 });
      }

      const isValid = await compare(code, portal.activationCode);
      if (!isValid) {
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

      await createPortalSession(tenant.id);
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

    const tenant = await prisma.tenant.findFirst({
      where: { email, isActive: true },
      include: { portalAccess: true },
    });

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
