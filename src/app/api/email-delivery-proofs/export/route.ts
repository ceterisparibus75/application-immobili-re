import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import {
  buildEmailDeliveryProofWhere,
  normalizeEmailDeliveryProofFilters,
  type EmailDeliveryProofSearchParams,
} from "@/lib/email-delivery-proof-filters";

function escapeCsv(value: string | number | null | undefined): string {
  const stringValue = value == null ? "" : String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatDate(value: Date | null | undefined): string {
  return value ? value.toISOString() : "";
}

function searchParamsToRecord(searchParams: URLSearchParams): EmailDeliveryProofSearchParams {
  return {
    status: searchParams.get("status") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const routeContext = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (routeContext instanceof NextResponse) return routeContext;

    const filters = normalizeEmailDeliveryProofFilters(searchParamsToRecord(request.nextUrl.searchParams));
    const where = buildEmailDeliveryProofWhere(routeContext.societyId, filters);

    const proofs = await prisma.emailDeliveryProof.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        createdAt: true,
        status: true,
        entityType: true,
        entityId: true,
        recipientEmail: true,
        recipientName: true,
        subject: true,
        provider: true,
        providerMessageId: true,
        sentAt: true,
        deliveredAt: true,
        bouncedAt: true,
        complainedAt: true,
        deliveryDelayedAt: true,
        htmlSha256: true,
        attachmentSha256: true,
        attachmentStoragePath: true,
        _count: { select: { events: true } },
      },
    });

    const header = [
      "ID",
      "Créé le",
      "Statut",
      "Type",
      "Destinataire email",
      "Destinataire nom",
      "Objet",
      "Entité ID",
      "Provider",
      "Message ID",
      "Envoyé le",
      "Livré le",
      "Rejeté le",
      "Plainte le",
      "Retard le",
      "Hash HTML",
      "Hash pièce jointe",
      "Chemin archive",
      "Événements",
    ];

    const rows = proofs.map((proof) =>
      [
        proof.id,
        formatDate(proof.createdAt),
        proof.status,
        proof.entityType,
        proof.recipientEmail,
        proof.recipientName,
        proof.subject,
        proof.entityId,
        proof.provider,
        proof.providerMessageId,
        formatDate(proof.sentAt),
        formatDate(proof.deliveredAt),
        formatDate(proof.bouncedAt),
        formatDate(proof.complainedAt),
        formatDate(proof.deliveryDelayedAt),
        proof.htmlSha256,
        proof.attachmentSha256,
        proof.attachmentStoragePath,
        proof._count.events,
      ]
        .map(escapeCsv)
        .join(","),
    );

    await createAuditLog({
      societyId: routeContext.societyId,
      userId: routeContext.userId,
      action: "EXPORT",
      entity: "EmailDeliveryProof",
      entityId: routeContext.societyId,
      details: { format: "csv", count: proofs.length, filters },
    });

    const csv = `\uFEFF${[header.map(escapeCsv).join(","), ...rows].join("\n")}`;
    const filename = `preuves-envoi-email-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[email-delivery-proofs-export]", error);
    return NextResponse.json(
      { error: { code: "EXPORT_ERROR", message: "Erreur lors de l'export des preuves d'envoi" } },
      { status: 500 },
    );
  }
}
