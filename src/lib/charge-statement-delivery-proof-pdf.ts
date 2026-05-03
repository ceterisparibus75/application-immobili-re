import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency, formatDate } from "@/lib/utils";

type DeliveryProof = {
  id: string;
  createdAt: Date;
  fiscalYear: number;
  periodStart: Date;
  periodEnd: Date;
  balance: number;
  recipientEmail: string;
  recipientName: string;
  provider: string;
  providerMessageId: string | null;
  status: string;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  lastEventAt: Date | null;
  lastEventType: string | null;
  pdfSha256: string;
  pdfSizeBytes: number;
  society: { name: string; email: string | null; siret: string | null };
  lease: { lot: { number: string; building: { name: string } } };
  events: Array<{ eventType: string; occurredAt: Date; providerEventId: string | null }>;
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

export async function generateChargeStatementDeliveryProofPdfBuffer(proof: DeliveryProof): Promise<Buffer> {
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
  page.drawText("Decompte annuel de charges", {
    x: 48,
    y: 754,
    size: 13,
    font: regular,
    color: rgb(0.35, 0.43, 0.55),
  });

  const lines = [
    `Reference preuve : ${proof.id}`,
    `Societe emettrice : ${proof.society.name}${proof.society.siret ? ` - SIRET ${proof.society.siret}` : ""}`,
    `Destinataire : ${proof.recipientName} <${proof.recipientEmail}>`,
    `Exercice : ${proof.fiscalYear}`,
    `Periode regularisee : ${formatDate(proof.periodStart)} - ${formatDate(proof.periodEnd)}`,
    `Lot : ${proof.lease.lot.number} - ${proof.lease.lot.building.name}`,
    `Solde du decompte : ${formatCurrency(proof.balance)}`,
    `Date d'envoi : ${formatDate(proof.createdAt)}`,
    `Prestataire : ${proof.provider}`,
    `Identifiant message : ${proof.providerMessageId ?? "non communique"}`,
    `Statut courant : ${statusLabel(proof.status)}`,
    `Date de livraison : ${proof.deliveredAt ? formatDate(proof.deliveredAt) : "non confirmee"}`,
    `Empreinte SHA-256 du PDF envoye : ${proof.pdfSha256}`,
    `Taille du PDF envoye : ${proof.pdfSizeBytes} octets`,
  ];

  let y = 710;
  for (const line of lines) {
    drawLine(page, line, 48, y);
    y -= 22;
  }

  page.drawText("Historique prestataire", {
    x: 48,
    y: y - 12,
    size: 13,
    font: bold,
    color: rgb(0.04, 0.16, 0.32),
  });
  y -= 38;

  const events = proof.events.length > 0 ? proof.events : [];
  if (events.length === 0) {
    drawLine(page, "Aucun evenement de livraison recu a la date de generation.", 48, y);
  } else {
    for (const event of events.slice(0, 16)) {
      drawLine(
        page,
        `${formatDate(event.occurredAt)} - ${event.eventType}${event.providerEventId ? ` (${event.providerEventId})` : ""}`,
        48,
        y
      );
      y -= 18;
    }
  }

  page.drawText("Document genere automatiquement par MyGestia.", {
    x: 48,
    y: 48,
    size: 8,
    font: regular,
    color: rgb(0.55, 0.62, 0.72),
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
