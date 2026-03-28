import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWebhookSignature } from "@/lib/docusign";
import { createAuditLog } from "@/lib/audit";
import type { SignatureStatus } from "@/generated/prisma/client";

// Correspondance statuts DocuSign -> enum interne
const STATUS_MAP: Record<string, SignatureStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  completed: "COMPLETED",
  declined: "DECLINED",
  voided: "VOIDED",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Lire le body brut pour la validation HMAC
  const rawBody = Buffer.from(await req.arrayBuffer());

  // 2. Valider la signature DocuSign Connect (HMAC-SHA256)
  const sig = req.headers.get("X-DocuSign-Signature-1") ?? "";
  if (!sig || !validateWebhookSignature(rawBody, sig)) {
    console.warn("[docusign webhook] signature invalide");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parser l'evenement
  let event: DocuSignConnectEvent;
  try {
    event = JSON.parse(rawBody.toString("utf-8")) as DocuSignConnectEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { envelopeId, status, completedDateTime, declinedDateTime, voidedDateTime } =
    event.data?.envelopeSummary ?? {};

  if (!envelopeId || !status) {
    return NextResponse.json({ ok: true }); // evenement ignorable
  }

  // 4. Trouver la demande en base
  const signatureRequest = await prisma.signatureRequest.findUnique({
    where: { envelopeId },
  });

  if (!signatureRequest) {
    // Enveloppe inconnue (peut etre creee hors app), on ignore
    return NextResponse.json({ ok: true });
  }

  // 5. Calculer les nouveaux champs selon le statut
  const internalStatus = STATUS_MAP[status.toLowerCase()] ?? "SENT";
  const updateData: Parameters<typeof prisma.signatureRequest.update>[0]["data"] = {
    status: internalStatus,
  };

  if (internalStatus === "COMPLETED" && completedDateTime) {
    updateData.signedAt = new Date(completedDateTime);
  }
  if (internalStatus === "DECLINED" && declinedDateTime) {
    updateData.declinedAt = new Date(declinedDateTime);
    updateData.declineReason =
      event.data?.envelopeSummary?.recipients?.signers?.[0]?.declinedReason ?? null;
  }
  if (internalStatus === "VOIDED" && voidedDateTime) {
    updateData.voidedAt = new Date(voidedDateTime);
    updateData.voidReason = event.data?.envelopeSummary?.voidedReason ?? null;
  }

  // 6. Mettre a jour en base
  await prisma.signatureRequest.update({
    where: { envelopeId },
    data: updateData,
  });

  // 7. Audit log
  await createAuditLog({
    societyId: signatureRequest.societyId,
    userId: undefined,
    action: "UPDATE",
    entity: "SignatureRequest",
    entityId: signatureRequest.id,
    details: { envelopeId, status: internalStatus },
  });

  return NextResponse.json({ ok: true });
}

// ── Types pour le payload DocuSign Connect ────────────────────────

interface DocuSignConnectEvent {
  event?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      envelopeId?: string;
      status?: string;
      completedDateTime?: string;
      declinedDateTime?: string;
      voidedDateTime?: string;
      voidedReason?: string;
      recipients?: {
        signers?: Array<{ declinedReason?: string }>;
      };
    };
  };
}
