import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { createPortalSession } from "@/lib/portal-auth";
import { portalActivateSchema } from "@/validations/portal";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = portalActivateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;

    // Trouver tous les locataires avec cet email (multi-société)
    const tenants = await prisma.tenant.findMany({
      where: { email: { equals: email, mode: "insensitive" }, isActive: true },
      include: { portalAccess: true },
    });

    // Trouver celui qui a un portalAccess avec un code d’activation
    const tenant = tenants.find((t) => t.portalAccess?.activationCode) ?? tenants.find((t) => t.portalAccess);

    if (!tenant || !tenant.portalAccess) {
      return NextResponse.json(
        { error: "Aucun compte portail trouvé pour cet email" },
        { status: 404 }
      );
    }

    const portal = tenant.portalAccess;

    if (!portal.activationCode || !portal.activationCodeExpiresAt) {
      return NextResponse.json(
        { error: "Aucun code d'activation en attente. Demandez un nouveau code à votre gestionnaire." },
        { status: 400 }
      );
    }

    if (new Date() > portal.activationCodeExpiresAt) {
      return NextResponse.json(
        { error: "Ce code a expiré. Demandez un nouveau code à votre gestionnaire." },
        { status: 400 }
      );
    }

    const isValid = await compare(code, portal.activationCode);
    if (!isValid) {
      return NextResponse.json({ error: "Code invalide" }, { status: 400 });
    }

    // Activer le portail
    await prisma.tenantPortalAccess.update({
      where: { id: portal.id },
      data: {
        isActive: true,
        activationCode: null,
        activationCodeExpiresAt: null,
        lastLoginAt: new Date(),
      },
    });

    // Créer la session portail
    // Créer la session avec l’email (accès multi-société)
    await createPortalSession(tenant.id, email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[portal/activate]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
