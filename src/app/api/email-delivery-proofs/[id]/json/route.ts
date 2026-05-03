import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { buildStorageFileName } from "@/lib/storage-path";

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(record[key])}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeContext = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (routeContext instanceof NextResponse) return routeContext;

    const { id } = await params;
    const proof = await prisma.emailDeliveryProof.findFirst({
      where: { id, societyId: routeContext.societyId },
      include: {
        society: { select: { name: true, email: true, siret: true } },
        sentBy: { select: { name: true, email: true } },
        events: { orderBy: { occurredAt: "asc" } },
      },
    });

    if (!proof) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Preuve d'envoi introuvable" } }, { status: 404 });
    }

    const exportedAt = new Date();
    const exportBodyWithoutHash = {
      schemaVersion: "email-delivery-proof-export-v1",
      exportedAt: exportedAt.toISOString(),
      proof,
    };
    const exportSha256 = sha256(stableJsonStringify(exportBodyWithoutHash));
    const exportBody = { ...exportBodyWithoutHash, exportSha256 };

    await createAuditLog({
      societyId: routeContext.societyId,
      userId: routeContext.userId,
      action: "EXPORT",
      entity: "EmailDeliveryProof",
      entityId: proof.id,
      details: { format: "json", exportSha256, eventCount: proof.events.length },
    });

    const filename = buildStorageFileName(["preuve-envoi-email", proof.id], "json", "preuve-envoi-email");

    return new NextResponse(JSON.stringify(exportBody, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[email-delivery-proof-json]", error);
    return NextResponse.json(
      { error: { code: "JSON_EXPORT_ERROR", message: "Erreur lors de l'export JSON de la preuve d'envoi" } },
      { status: 500 },
    );
  }
}
