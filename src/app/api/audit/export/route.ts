import { auth } from "@/lib/auth";
import { getAuditLogsForExport, createAuditLog } from "@/lib/audit";
import { requireSocietyAccess } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import type { AuditAction } from "@/generated/prisma/client";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Genere un hash SHA-256 d'une chaine */
function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
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
    const certified = searchParams.get("certified") === "true";

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

    // Build CSV — with optional certification hash per row
    const baseHeader = "Date,Utilisateur,Email,Action,Entité,ID Entité,Détails";
    const header = certified ? `${baseHeader},Hash SHA-256` : baseHeader;

    const rows = logs.map((log) => {
      const date = new Date(log.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      const userName = log.user?.name ?? "Système";
      const userEmail = log.user?.email ?? "";
      const details = log.details ? JSON.stringify(log.details) : "";
      const cells = [date, userName, userEmail, log.action, log.entity, log.entityId, details];
      const row = cells.map(escapeCsv).join(",");

      if (certified) {
        // Hash de la ligne brute (avant escapeCsv) pour integrite
        const rawData = `${log.id}|${log.createdAt}|${userEmail}|${log.action}|${log.entity}|${log.entityId}|${details}`;
        return `${row},${sha256(rawData)}`;
      }

      return row;
    });

    let csv = "\uFEFF" + [header, ...rows].join("\n");

    // Certification globale : hash SHA-256 de l'ensemble du contenu
    if (certified) {
      const exportDate = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      const exporterEmail = session.user.email ?? session.user.id;
      const globalHash = sha256(csv);
      csv += `\n\n# CERTIFICATION`;
      csv += `\n# Export certifié le ${exportDate}`;
      csv += `\n# Exporté par : ${exporterEmail}`;
      csv += `\n# Nombre d'entrées : ${logs.length}`;
      csv += `\n# Hash SHA-256 du document : ${globalHash}`;
      csv += `\n# Ce hash permet de vérifier que le fichier n'a pas été altéré après export.`;
    }

    // Audit the export itself
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "EXPORT",
      entity: "AuditLog",
      entityId: societyId,
      details: { format: "csv", count: logs.length, certified },
    });

    const filename = certified
      ? `audit-logs-certifie-${new Date().toISOString().slice(0, 10)}.csv`
      : `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/audit/export]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
