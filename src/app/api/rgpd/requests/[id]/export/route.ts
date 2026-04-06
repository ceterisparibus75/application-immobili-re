import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { exportTenantData } from "@/lib/rgpd-export";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) {
    return NextResponse.json(
      { error: "Societe non selectionnee" },
      { status: 400 }
    );
  }

  await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

  const { id } = await params;

  const gdprRequest = await prisma.gdprRequest.findFirst({
    where: { id, societyId },
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
      societyId,
      gdprRequest.requesterEmail
    );

    await createAuditLog({
      societyId,
      userId: session.user.id,
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
