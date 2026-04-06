import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import {
  BRAND_DEEP, BRAND_BLUE, BRAND_LIGHT, WHITE, GRAY, BLACK,
  PW, PH, MRG, HEADER_HEIGHT, COVER_SIDEBAR_W,
  FONT_FOOTER, FONT_SMALL,
} from "./constants";
import type { ReportSociety } from "./types";
import { formatCurrency } from "@/lib/utils";

/** formatCurrency for pdf-lib: replace narrow no-break space U+202F (not in WinAnsi) */
export function pdfCur(amount: number): string {
  return formatCurrency(amount).replace(/\u202F/g, " ").replace(/\u00A0/g, " ");
}

export interface PdfContext {
  doc: PDFDocument;
  bold: PDFFont;
  reg: PDFFont;
  serif: PDFFont;
  serifBold: PDFFont;
  np: (landscape?: boolean) => PDFPage;
  save: () => Promise<Buffer>;
  society: ReportSociety | null;
}

/**
 * Initialize a PDF document with branded header/footer on each page.
 */
export async function initPdf(
  title: string,
  subtitle: string,
  society?: ReportSociety | null
): Promise<PdfContext> {
  const doc  = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const ds   = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  const societyName = society?.name ?? null;

  const societyFooterParts: string[] = [];
  if (society?.addressLine1) societyFooterParts.push(society.addressLine1);
  if (society?.postalCode || society?.city)
    societyFooterParts.push([society.postalCode, society.city].filter(Boolean).join(" "));
  if (society?.siret) societyFooterParts.push(`SIRET : ${society.siret}`);
  const societyFooter = societyFooterParts.length > 0 ? societyFooterParts.join(" - ") : null;

  let pageCount = 0;

  const np = (landscape = false): PDFPage => {
    pageCount++;
    const pw = landscape ? PH : PW;
    const ph = landscape ? PW : PH;
    const p = doc.addPage([pw, ph]);

    // Header bar
    p.drawRectangle({ x: 0, y: ph - HEADER_HEIGHT, width: pw, height: HEADER_HEIGHT, color: BRAND_DEEP });

    // Society name top-right
    if (societyName) {
      const nameWidth = bold.widthOfTextAtSize(societyName, 10);
      p.drawText(societyName, { x: pw - MRG - nameWidth, y: ph - 22, size: 10, font: bold, color: WHITE });
    }

    // Title (Serif) & subtitle
    p.drawText(title, { x: MRG, y: ph - 24, size: 13, font: serifBold, color: WHITE });
    p.drawText(subtitle, { x: MRG, y: ph - 40, size: 8, font: reg, color: BRAND_LIGHT });

    // Generation date
    const dateStr = `Généré le ${ds}`;
    const dateW = reg.widthOfTextAtSize(dateStr, 7);
    p.drawText(dateStr, { x: pw - MRG - dateW, y: ph - 40, size: 7, font: reg, color: BRAND_LIGHT });

    // Footer line
    p.drawLine({ start: { x: MRG, y: 28 }, end: { x: pw - MRG, y: 28 }, thickness: 0.5, color: GRAY });
    const footerLabel = societyName
      ? `${societyName} - Page ${pageCount}`
      : `MyGestia - Page ${pageCount}`;
    p.drawText(footerLabel, { x: MRG, y: 16, size: FONT_FOOTER, font: reg, color: GRAY });

    // Footer date right-aligned
    const footerDate = `Généré le ${ds}`;
    const fdW = reg.widthOfTextAtSize(footerDate, FONT_FOOTER);
    p.drawText(footerDate, { x: pw - MRG - fdW, y: 16, size: FONT_FOOTER, font: reg, color: GRAY });

    // Society footer centered
    if (societyFooter) {
      const sfW = reg.widthOfTextAtSize(societyFooter, FONT_SMALL);
      p.drawText(societyFooter, { x: (pw - sfW) / 2, y: 7, size: FONT_SMALL, font: reg, color: GRAY });
    }

    return p;
  };

  return {
    doc,
    bold,
    reg,
    serif,
    serifBold,
    np,
    save: async () => Buffer.from(await doc.save()),
    society: society ?? null,
  };
}

/**
 * Draw a branded cover page with left sidebar.
 */
export function drawCoverPage(
  ctx: PdfContext,
  reportTitle: string,
  reportSubtitle: string,
  details: string[]
): void {
  const p = ctx.doc.addPage([PW, PH]);
  const ds = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

  // Left sidebar
  p.drawRectangle({ x: 0, y: 0, width: COVER_SIDEBAR_W, height: PH, color: BRAND_DEEP });

  // Sidebar: society name (Serif)
  const name = ctx.society?.name ?? "MyGestia";
  p.drawText(name, {
    x: 25,
    y: PH - 60,
    size: 14,
    font: ctx.serifBold,
    color: WHITE,
  });

  // Sidebar: contact info at bottom
  const contactLines: string[] = [];
  if (ctx.society?.addressLine1) contactLines.push(ctx.society.addressLine1);
  if (ctx.society?.postalCode || ctx.society?.city)
    contactLines.push([ctx.society.postalCode, ctx.society.city].filter(Boolean).join(" "));
  if (ctx.society?.siret) contactLines.push(`SIRET : ${ctx.society.siret}`);
  if (ctx.society?.phone) contactLines.push(ctx.society.phone);
  if (ctx.society?.email) contactLines.push(ctx.society.email);

  let cy = 120;
  for (const line of contactLines) {
    p.drawText(line, { x: 25, y: cy, size: 7, font: ctx.reg, color: BRAND_LIGHT });
    cy -= 14;
  }

  // Sidebar: generation date
  p.drawText(`Généré le ${ds}`, { x: 25, y: 40, size: 7, font: ctx.reg, color: BRAND_LIGHT });

  // Right area: report title (Serif)
  const rightX = COVER_SIDEBAR_W + 50;
  p.drawText(reportTitle, {
    x: rightX,
    y: PH - 200,
    size: 26,
    font: ctx.serifBold,
    color: BRAND_DEEP,
  });

  // Subtitle (Serif)
  p.drawText(reportSubtitle, {
    x: rightX,
    y: PH - 235,
    size: 12,
    font: ctx.serif,
    color: GRAY,
  });

  // Accent bar
  p.drawRectangle({
    x: rightX,
    y: PH - 250,
    width: 80,
    height: 3,
    color: BRAND_BLUE,
  });

  // Detail lines
  let dy = PH - 290;
  for (const detail of details) {
    p.drawText(detail, { x: rightX, y: dy, size: 10, font: ctx.reg, color: BLACK });
    dy -= 22;
  }
}

/** Starting Y position for content after the header */
export function contentStartY(landscape = false): number {
  return (landscape ? PW : PH) - HEADER_HEIGHT - 20;
}

/** Minimum Y before we need a page break */
export function minY(): number {
  return 65;
}
