import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { createAuditLog } from "@/lib/audit";
import { exportTenantData } from "@/lib/rgpd-export";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireActiveSocietyRouteContext({ minRole: "ADMIN_SOCIETE" });
  if (context instanceof NextResponse) return context;

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string; // "approve" | "refuse"

  const gdprRequest = await prisma.gdprRequest.findFirst({
    where: { id, societyId: context.societyId, status: "pending" },
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
        processedBy: context.userId,
      },
    });
    return NextResponse.json({ message: "Demande refusee" });
  }

  // Traiter la demande selon le type
  try {
    switch (gdprRequest.requestType) {
      case "deletion":
        await processDataDeletion(context.societyId, gdprRequest.requesterEmail);
        break;
      case "access":
      case "portability": {
        // Export automatique des donnees du locataire
        const exportData = await exportTenantData(
          context.societyId,
          gdprRequest.requesterEmail
        );

        await createAuditLog({
          societyId: context.societyId,
          userId: context.userId,
          action: "EXPORT",
          entity: "GdprRequest",
          entityId: id,
          details: {
            type: gdprRequest.requestType,
            email: gdprRequest.requesterEmail,
            tenantCount: exportData.tenants.length,
          },
        });
        break;
      }
      case "rectification":
        // La rectification est manuelle — marquer comme traitee
        break;
      case "opposition":
        // Opposition au traitement — desactiver le locataire
        await processOpposition(context.societyId, gdprRequest.requesterEmail);
        break;
    }

    await prisma.gdprRequest.update({
      where: { id },
      data: {
        status: "completed",
        processedAt: new Date(),
        processedBy: context.userId,
      },
    });

    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
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
