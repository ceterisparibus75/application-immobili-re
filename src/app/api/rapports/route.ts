import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { createAuditLog } from "@/lib/audit";
import { generateReport, type ReportOptions } from "@/lib/reports";
import { generateReportSchema } from "@/validations/report";

// POST /api/rapports — génère et renvoie un rapport en téléchargement
export async function POST(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (context instanceof NextResponse)
      return NextResponse.json(
        {
          error: context.status === 400
            ? { code: "NO_SOCIETY", message: "Société non sélectionnée" }
            : context.status === 403
              ? { code: "FORBIDDEN", message: "Accès refusé" }
              : { code: "UNAUTHORIZED", message: "Non authentifié" },
        },
        { status: context.status }
      );

    // 2. Validation Zod du body
    const rawBody = await req.json().catch(() => null);
    if (!rawBody)
      return NextResponse.json(
        { error: { code: "INVALID_BODY", message: "Le corps de la requête est invalide" } },
        { status: 400 }
      );

    const parsed = generateReportSchema.safeParse(rawBody);
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: messages } },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // 3. Génération du rapport
    const opts: ReportOptions = {
      societyId: context.societyId,
      type: body.type,
      year: body.year,
      buildingId: body.buildingId,
      tenantId: body.tenantId,
      format: body.format,
    };

    const result = await generateReport(opts);

    // 4. Audit log
    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "EXPORT",
      entity: "Report",
      entityId: body.type,
      details: { filename: result.filename, year: body.year, format: body.format },
    });

    // 5. Réponse binaire
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Erreurs métier remontées par le générateur (ex: locataire introuvable)
    if (error instanceof Error && error.message.includes("introuvable"))
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );

    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/rapports]", error);
    return NextResponse.json(
      { error: { code: "GENERATION_FAILED", message: msg } },
      { status: 500 }
    );
  }
}
