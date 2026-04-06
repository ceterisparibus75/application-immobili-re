import { auth } from "@/lib/auth";
import { getAuditLogsForExport, createAuditLog } from "@/lib/audit";
import { requireSocietyAccess } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import type { AuditAction } from "@/generated/prisma/client";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const societyId = searchParams.get("societyId");
    const action = searchParams.get("action") as AuditAction | null;
    const entity = searchParams.get("entity");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    if (!societyId) {
      return NextResponse.json({ error: "societyId requis" }, { status: 400 });
    }

    if (!/^c[a-z0-9]{24,}$/.test(societyId)) {
      return NextResponse.json({ error: "societyId invalide" }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const logs = await getAuditLogsForExport(societyId, {
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
      ...(userId ? { userId } : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
      ...(search ? { search } : {}),
    });

    // Build CSV
    const header = "Date,Utilisateur,Email,Action,Entité,ID Entité,Détails";
    const rows = logs.map((log) => {
      const date = new Date(log.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      const userName = log.user?.name ?? "Système";
      const userEmail = log.user?.email ?? "";
      const details = log.details ? JSON.stringify(log.details) : "";
      return [date, userName, userEmail, log.action, log.entity, log.entityId, details]
        .map(escapeCsv)
        .join(",");
    });

    const csv = "\uFEFF" + [header, ...rows].join("\n");

    // Audit the export itself
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "EXPORT",
      entity: "AuditLog",
      entityId: societyId,
      details: { format: "csv", count: logs.length },
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/audit/export]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
