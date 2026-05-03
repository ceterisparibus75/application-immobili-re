import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { buildStorageFileName } from "@/lib/storage-path";
import { generateChargeStatementDeliveryProofPdfBuffer } from "@/lib/charge-statement-delivery-proof-pdf";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeContext = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (routeContext instanceof NextResponse) return routeContext;

    const { id } = await params;
    const proof = await prisma.chargeStatementDelivery.findFirst({
      where: { id, societyId: routeContext.societyId },
      include: {
        society: { select: { name: true, email: true, siret: true } },
        lease: {
          select: {
            lot: {
              select: {
                number: true,
                building: { select: { name: true } },
              },
            },
          },
        },
        events: { orderBy: { occurredAt: "asc" } },
      },
    });

    if (!proof) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Preuve d'envoi introuvable" } }, { status: 404 });
    }

    const pdfBuffer = await generateChargeStatementDeliveryProofPdfBuffer(proof);
    const filename = buildStorageFileName(
      ["preuve-envoi-decompte", String(proof.fiscalYear), proof.recipientName],
      "pdf",
      "preuve-envoi-decompte"
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[charge-delivery-proof-pdf]", error);
    return NextResponse.json(
      { error: { code: "PDF_ERROR", message: "Erreur lors de la génération de l'attestation" } },
      { status: 500 }
    );
  }
}
