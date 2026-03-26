import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateReport, type ReportOptions } from "@/lib/report-generator";
import { generateReportSchema } from "@/validations/report";

// POST /api/rapports — génère et renvoie un rapport en téléchargement
export async function POST(req: NextRequest) {
  try {
    // 1. Authentification
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié" } },
        { status: 401 }
      );

    // 2. Société active
    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId)
      return NextResponse.json(
        { error: { code: "NO_SOCIETY", message: "Société non sélectionnée" } },
        { status: 400 }
      );

    // 3. Permissions
    await requireSocietyAccess(session.user.id, societyId);

    // 4. Validation Zod du body
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

    // 5. Génération du rapport
    const opts: ReportOptions = {
      societyId,
      type: body.type,
      year: body.year,
      buildingId: body.buildingId,
      tenantId: body.tenantId,
      format: body.format,
    };

    const result = await generateReport(opts);

    // 6. Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "EXPORT",
      entity: "Report",
      entityId: body.type,
      details: { filename: result.filename, year: body.year, format: body.format },
    });

    // 7. Réponse binaire
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
    if (error instanceof ForbiddenError)
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: error.message } },
        { status: 403 }
      );

    // Erreurs métier remontées par le générateur (ex: locataire introuvable)
    if (error instanceof Error && error.message.includes("introuvable"))
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );

    console.error("[POST /api/rapports]", error);
    return NextResponse.json(
      { error: { code: "GENERATION_FAILED", message: "Erreur lors de la génération du rapport" } },
      { status: 500 }
    );
  }
}
