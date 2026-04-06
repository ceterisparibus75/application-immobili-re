/**
 * Générateur PDF pour les courriers types.
 * Utilise pdf-lib pour produire des lettres professionnelles avec en-tête et pied de page.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const PW = 595.28; // A4 width
const PH = 841.89; // A4 height
const MRG = 50;
const CW = PW - 2 * MRG;
const LINE_HEIGHT = 16;
const FONT_SIZE = 10;
const SMALL = 8;
const BLUE = rgb(0.12, 0.29, 0.58);
const GRAY = rgb(0.5, 0.5, 0.5);
const BLACK = rgb(0.1, 0.1, 0.1);

interface LetterPdfOptions {
  senderName: string;
  senderAddress: string;
  recipientName: string;
  recipientAddress: string;
  date: string;
  lieu: string;
  subject: string;
  /** Le corps du courrier en HTML simplifié (sera converti en texte) */
  bodyHtml: string;
  /** Nom de la société pour le pied de page */
  societyName?: string;
  societySiret?: string;
}

/**
 * Convertit du HTML simplifié en lignes de texte avec formatage basique.
 */
function htmlToLines(html: string): { text: string; bold: boolean; indent: number; spacing: number }[] {
  const lines: { text: string; bold: boolean; indent: number; spacing: number }[] = [];

  // Nettoyer le HTML
  const clean = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "LIST_ITEM")
    .replace(/<ul>/gi, "")
    .replace(/<\/ul>/gi, "")
    .replace(/<p>/gi, "");

  // Traiter les segments bold
  const segments = clean.split(/(<strong>|<\/strong>)/gi);
  let currentText = "";
  let isBold = false;

  for (const seg of segments) {
    if (seg.toLowerCase() === "<strong>") {
      if (currentText.trim()) pushText(currentText, false);
      currentText = "";
      isBold = true;
    } else if (seg.toLowerCase() === "</strong>") {
      if (currentText.trim()) pushText(currentText, true);
      currentText = "";
      isBold = false;
    } else {
      currentText += seg;
    }
  }
  if (currentText.trim()) pushText(currentText, isBold);

  function pushText(text: string, bold: boolean): void {
    // Supprimer les tags HTML restants
    const stripped = text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");

    const rawLines = stripped.split("\n");
    for (const line of rawLines) {
      const trimmed = line.trim();
      if (trimmed === "") {
        lines.push({ text: "", bold: false, indent: 0, spacing: 8 });
      } else if (trimmed.startsWith("LIST_ITEM")) {
        lines.push({ text: "  \u2022  " + trimmed.replace("LIST_ITEM", "").trim(), bold, indent: 10, spacing: 4 });
      } else {
        lines.push({ text: trimmed, bold, indent: 0, spacing: 0 });
      }
    }
  }

  return lines;
}

/**
 * Découpe un texte long en lignes qui tiennent dans la largeur disponible.
 */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const result: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
      if (current) result.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) result.push(current);
  return result.length === 0 ? [""] : result;
}

export async function generateLetterPdf(options: LetterPdfOptions): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  let page = doc.addPage([PW, PH]);
  let y = PH - MRG;
  let pageCount = 1;

  const addFooter = (p: typeof page, num: number): void => {
    p.drawLine({ start: { x: MRG, y: 35 }, end: { x: PW - MRG, y: 35 }, thickness: 0.5, color: GRAY });
    const footerParts = [options.societyName ?? ""];
    if (options.societySiret) footerParts.push("SIRET : " + options.societySiret);
    footerParts.push("Page " + num);
    p.drawText(footerParts.filter(Boolean).join(" — "), { x: MRG, y: 22, size: 7, font: reg, color: GRAY });
  };

  const newPage = (): void => {
    addFooter(page, pageCount);
    page = doc.addPage([PW, PH]);
    pageCount++;
    y = PH - MRG;
  };

  const checkSpace = (needed: number): void => {
    if (y - needed < 55) newPage();
  };

  // ── En-tête : Expéditeur (en haut à gauche) ──
  const senderLines = options.senderName.split("\n").concat(options.senderAddress.split("\n"));
  for (const line of senderLines) {
    if (line.trim()) {
      page.drawText(line.trim(), { x: MRG, y, size: FONT_SIZE, font: reg, color: BLACK });
      y -= LINE_HEIGHT;
    }
  }

  y -= 20;

  // ── Destinataire (en haut à droite) ──
  const recipX = PW / 2 + 30;
  const recipLines = options.recipientName.split("\n").concat(options.recipientAddress.split("\n"));
  let recipY = PH - MRG;
  for (const line of recipLines) {
    if (line.trim()) {
      page.drawText(line.trim(), { x: recipX, y: recipY, size: FONT_SIZE, font: reg, color: BLACK });
      recipY -= LINE_HEIGHT;
    }
  }

  // S'assurer que y est sous les deux blocs
  y = Math.min(y, recipY) - 20;

  // ── Lieu et date ──
  const dateLine = `${options.lieu}, le ${options.date}`;
  page.drawText(dateLine, { x: MRG, y, size: FONT_SIZE, font: reg, color: BLACK });
  y -= LINE_HEIGHT * 2;

  // ── Objet ──
  checkSpace(40);
  page.drawText("Objet : " + options.subject, { x: MRG, y, size: FONT_SIZE, font: bold, color: BLUE });
  y -= LINE_HEIGHT;
  page.drawLine({ start: { x: MRG, y: y + 4 }, end: { x: MRG + CW, y: y + 4 }, thickness: 1, color: BLUE });
  y -= LINE_HEIGHT;

  // ── Corps du courrier ──
  const contentLines = htmlToLines(options.bodyHtml);

  for (const line of contentLines) {
    if (line.text === "") {
      y -= line.spacing || 8;
      continue;
    }

    const font = line.bold ? bold : reg;
    const maxW = CW - line.indent;
    const wrapped = wrapText(line.text, font, FONT_SIZE, maxW);

    for (const wl of wrapped) {
      checkSpace(LINE_HEIGHT + 5);
      page.drawText(wl, {
        x: MRG + line.indent,
        y,
        size: FONT_SIZE,
        font,
        color: BLACK,
      });
      y -= LINE_HEIGHT;
    }
    y -= line.spacing;
  }

  // ── Signature ──
  y -= 30;
  checkSpace(60);
  page.drawText(options.senderName, { x: PW / 2 + 30, y, size: FONT_SIZE, font: bold, color: BLACK });
  y -= LINE_HEIGHT;
  page.drawText("Signature", { x: PW / 2 + 30, y, size: SMALL, font: reg, color: GRAY });

  // Footer de la dernière page
  addFooter(page, pageCount);

  return Buffer.from(await doc.save());
}
