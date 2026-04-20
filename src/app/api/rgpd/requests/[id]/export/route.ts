import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { createAuditLog } from "@/lib/audit";
import { exportTenantData } from "@/lib/rgpd-export";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireActiveSocietyRouteContext({ minRole: "ADMIN_SOCIETE" });
  if (context instanceof NextResponse) return context;

  const { id } = await params;

  const gdprRequest = await prisma.gdprRequest.findFirst({
    where: { id, societyId: context.societyId },
  });

  if (!gdprRequest) {
    return NextResponse.json(
      { error: "Demande introuvable" },
      { status: 404 }
    );
  }

  if (
    gdprRequest.requestType !== "access" &&
    gdprRequest.requestType !== "portability"
  ) {
    return NextResponse.json(
      { error: "L'export n'est disponible que pour les demandes d'acces ou de portabilite" },
      { status: 400 }
    );
  }

  try {
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
      },
    });

    const json = JSON.stringify(exportData, null, 2);
    const fileName = `rgpd-export-${gdprRequest.requesterEmail.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[rgpd-export]", error);
    return NextResponse.json(
      { error: "Erreur lors de l'export des donnees" },
      { status: 500 }
    );
  }
}
