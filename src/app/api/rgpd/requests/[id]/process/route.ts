import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) {
    return NextResponse.json({ error: "Societe non selectionnee" }, { status: 400 });
  }

  await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string; // "approve" | "refuse"

  const gdprRequest = await prisma.gdprRequest.findFirst({
    where: { id, societyId, status: "pending" },
  });

  if (!gdprRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (action === "refuse") {
    await prisma.gdprRequest.update({
      where: { id },
      data: {
        status: "refused",
        processedAt: new Date(),
        processedBy: session.user.id,
      },
    });
    return NextResponse.json({ message: "Demande refusee" });
  }

  // Traiter la demande selon le type
  try {
    switch (gdprRequest.requestType) {
      case "deletion":
        await processDataDeletion(societyId, gdprRequest.requesterEmail);
        break;
      case "access":
      case "portability":
        // L'export se fait via l'interface — marquer comme traitee
        break;
      case "rectification":
        // La rectification est manuelle — marquer comme traitee
        break;
      case "opposition":
        // Opposition au traitement — desactiver le locataire
        await processOpposition(societyId, gdprRequest.requesterEmail);
        break;
    }

    await prisma.gdprRequest.update({
      where: { id },
      data: {
        status: "completed",
        processedAt: new Date(),
        processedBy: session.user.id,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "GdprRequest",
      entityId: id,
      details: { type: gdprRequest.requestType, email: gdprRequest.requesterEmail },
    });

    return NextResponse.json({ message: "Demande traitee avec succes" });
  } catch (err) {
    console.error("[rgpd-process]", err);
    return NextResponse.json({ error: "Erreur lors du traitement" }, { status: 500 });
  }
}

async function processDataDeletion(societyId: string, email: string) {
  // Trouver les locataires correspondants
  const tenants = await prisma.tenant.findMany({
    where: { societyId, email },
  });

  for (const tenant of tenants) {
    // Verifier qu'il n'y a pas de bail actif
    const activeLeases = await prisma.lease.count({
      where: { tenantId: tenant.id, status: "EN_COURS" },
    });

    if (activeLeases > 0) {
      throw new Error(`Le locataire ${tenant.firstName} ${tenant.lastName} a un bail actif — impossible de supprimer`);
    }

    // Anonymiser les donnees personnelles (soft delete)
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        firstName: "ANONYMISE",
        lastName: "ANONYMISE",
        email: `anonymise-${tenant.id}@deleted.local`,
        phone: null,
        mobile: null,
        birthDate: null,
        birthPlace: null,
        personalAddress: null,
        idDocumentUrl: null,
        notes: null,
        isActive: false,
      },
    });
  }

  // Supprimer les documents d'identite associes (si categories comme tels)
  // Les documents comptables sont conserves 10 ans (obligation legale)
}

async function processOpposition(societyId: string, email: string) {
  // Archiver les locataires qui s'opposent au traitement
  await prisma.tenant.updateMany({
    where: { societyId, email },
    data: { isActive: false },
  });
}
