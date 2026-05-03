import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDate } from "@/lib/utils";

type EmailDeliveryProofPdf = {
  id: string;
  createdAt: Date;
  entityType: string;
  entityId: string | null;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  provider: string;
  providerMessageId: string | null;
  status: string;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  deliveryDelayedAt: Date | null;
  lastEventAt: Date | null;
  lastEventType: string | null;
  htmlSha256: string | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentSha256: string | null;
  attachmentSizeBytes: number | null;
  society: { name: string; email: string | null; siret: string | null } | null;
  sentBy: { name: string | null; email: string } | null;
  events: Array<{ eventType: string; occurredAt: Date; providerEventId: string | null; payload?: unknown }>;
};

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    SENT: "Envoye au prestataire email",
    DELIVERED: "Livre au destinataire",
    BOUNCED: "Rejete par le serveur destinataire",
    COMPLAINED: "Signale comme indesirable",
    DELIVERY_DELAYED: "Livraison retardee",
    FAILED: "Echec",
  };
  return labels[status] ?? status;
}

function drawLine(page: import("pdf-lib").PDFPage, text: string, x: number, y: number, size = 10) {
  page.drawText(text.replace(/\u202f/g, " "), { x, y, size, color: rgb(0.12, 0.18, 0.28) });
}

export function payloadSha256FromEventPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const metadata = (payload as Record<string, unknown>)._mygestia;
  if (!metadata || typeof metadata !== "object") return null;

  const hash = (metadata as Record<string, unknown>).payloadSha256;
  return typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}

export async function generateEmailDeliveryProofPdfBuffer(proof: EmailDeliveryProofPdf): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText("Attestation de preuve d'envoi", {
    x: 48,
    y: 780,
    size: 20,
    font: bold,
    color: rgb(0.04, 0.16, 0.32),
  });
  page.drawText("Email transactionnel MyGestia", {
    x: 48,
    y: 754,
    size: 13,
    font: regular,
    color: rgb(0.35, 0.43, 0.55),
  });

  const sender = proof.society
    ? `${proof.society.name}${proof.society.siret ? ` - SIRET ${proof.society.siret}` : ""}`
    : "Societe non renseignee";
  const sentBy = proof.sentBy ? `${proof.sentBy.name ?? proof.sentBy.email} <${proof.sentBy.email}>` : "non renseigne";

  const lines = [
    `Reference preuve : ${proof.id}`,
    `Type document : ${proof.entityType}${proof.entityId ? ` - ${proof.entityId}` : ""}`,
    `Societe emettrice : ${sender}`,
    `Utilisateur emetteur : ${sentBy}`,
    `Destinataire : ${proof.recipientName ?? "non renseigne"} <${proof.recipientEmail}>`,
    `Objet : ${proof.subject}`,
    `Date d'envoi : ${formatDate(proof.createdAt)}`,
    `Prestataire : ${proof.provider}`,
    `Identifiant message : ${proof.providerMessageId ?? "non communique"}`,
    `Statut courant : ${statusLabel(proof.status)}`,
    `Date de livraison : ${proof.deliveredAt ? formatDate(proof.deliveredAt) : "non confirmee"}`,
    `Date de rejet : ${proof.bouncedAt ? formatDate(proof.bouncedAt) : "aucun rejet connu"}`,
    `Empreinte SHA-256 du HTML envoye : ${proof.htmlSha256 ?? "non calculee"}`,
    `Piece jointe : ${proof.attachmentFileName ?? "aucune"}`,
    `Type piece jointe : ${proof.attachmentMimeType ?? "non applicable"}`,
    `Empreinte SHA-256 piece jointe : ${proof.attachmentSha256 ?? "non applicable"}`,
    `Taille piece jointe : ${proof.attachmentSizeBytes ?? 0} octets`,
  ];

  let y = 710;
  for (const line of lines) {
    drawLine(page, line.slice(0, 118), 48, y);
    y -= 20;
  }

  page.drawText("Historique prestataire", {
    x: 48,
    y: y - 12,
    size: 13,
    font: bold,
    color: rgb(0.04, 0.16, 0.32),
  });
  y -= 38;

  if (proof.events.length === 0) {
    drawLine(page, "Aucun evenement de livraison recu a la date de generation.", 48, y);
  } else {
    for (const event of proof.events.slice(0, 16)) {
      const payloadHash = payloadSha256FromEventPayload(event.payload);
      drawLine(
        page,
        `${formatDate(event.occurredAt)} - ${event.eventType}${event.providerEventId ? ` (${event.providerEventId})` : ""}`,
        48,
        y
      );
      y -= 18;
      if (payloadHash) {
        drawLine(page, `Empreinte payload webhook : ${payloadHash}`, 64, y, 8);
        y -= 14;
      }
    }
  }

  page.drawText("Cette attestation reprend le journal non destructif et les empreintes conservees par MyGestia.", {
    x: 48,
    y: 48,
    size: 8,
    font: regular,
    color: rgb(0.55, 0.62, 0.72),
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
