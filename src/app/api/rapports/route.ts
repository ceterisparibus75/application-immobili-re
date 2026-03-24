import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateReport, type ReportType, type ReportOptions } from "@/lib/report-generator";
import { ForbiddenError } from "@/lib/permissions";

// POST /api/rapports — génère et renvoie un rapport en téléchargement
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifié" } }, { status: 401 });

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId)
      return NextResponse.json({ error: { code: "NO_SOCIETY", message: "Société non sélectionnée" } }, { status: 400 });

    await requireSocietyAccess(session.user.id, societyId);

    const body = await req.json() as {
      type: ReportType;
      year?: number;
      buildingId?: string;
      tenantId?: string;
      format?: "pdf" | "xlsx";
    };

    const opts: ReportOptions = {
      societyId,
      type: body.type,
      year: body.year,
      buildingId: body.buildingId,
      tenantId: body.tenantId,
      format: body.format ?? "pdf",
    };

    const result = await generateReport(opts);

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "EXPORT",
      entity: "Report",
      entityId: body.type,
      details: { filename: result.filename, year: body.year, format: opts.format },
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: { code: "FORBIDDEN", message: error.message } }, { status: 403 });
    console.error("[POST /api/rapports]", error);
    return NextResponse.json(
      { error: { code: "GENERATION_FAILED", message: "Erreur lors de la génération du rapport" } },
      { status: 500 }
    );
  }
}
