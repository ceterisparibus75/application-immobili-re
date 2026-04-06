import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import {
  BRAND_DEEP, BRAND_LIGHT, WHITE, BLACK, GRAY, GRAY_LIGHT, GRAY_LINE, CORAL,
  MRG, CW, ROW_HEIGHT, SECTION_HEIGHT,
  FONT_SECTION, FONT_TABLE_HD, FONT_TABLE,
} from "./constants";
import type { ColAlign } from "./types";

// ── Section Header ──────────────────────────────────────────────────

/**
 * @param font - Pass serifBold for audit-quality sections, or bold for backward compatibility.
 */
export function drawSectionHeader(
  p: PDFPage,
  font: PDFFont,
  y: number,
  title: string,
  pw?: number
): number {
  const cw = pw ? pw - 2 * MRG : CW;
  p.drawRectangle({ x: MRG, y: y - SECTION_HEIGHT + 2, width: cw, height: SECTION_HEIGHT, color: BRAND_DEEP });
  p.drawText(title, { x: MRG + 10, y: y - SECTION_HEIGHT + 7, size: FONT_SECTION, font, color: WHITE });
  return y - SECTION_HEIGHT - 4;
}

// ── Table Header Row ────────────────────────────────────────────────

export function drawTableHeader(
  p: PDFPage,
  bold: PDFFont,
  y: number,
  headers: string[],
  widths: number[],
  aligns?: ColAlign[],
  pw?: number
): number {
  const cw = pw ? pw - 2 * MRG : CW;
  p.drawRectangle({ x: MRG, y: y - ROW_HEIGHT, width: cw, height: ROW_HEIGHT, color: BRAND_DEEP });
  let x = MRG + 3;
  headers.forEach((h, i) => {
    const align = aligns?.[i] ?? "left";
    const text = h.slice(0, 20);
    const tw = bold.widthOfTextAtSize(text, FONT_TABLE_HD);
    let tx = x;
    if (align === "right") tx = x + widths[i] - tw - 6;
    else if (align === "center") tx = x + (widths[i] - tw) / 2;
    p.drawText(text, { x: tx, y: y - ROW_HEIGHT + 4, size: FONT_TABLE_HD, font: bold, color: WHITE });
    x += widths[i];
  });
  return y - ROW_HEIGHT;
}

// ── Table Data Row ──────────────────────────────────────────────────

export function drawTableRow(
  p: PDFPage,
  reg: PDFFont,
  y: number,
  cells: string[],
  widths: number[],
  aligns?: ColAlign[],
  options?: {
    rowIndex?: number;
    cellColors?: (RGB | null)[];
    bold?: PDFFont;
    boldCols?: number[];
  },
  pw?: number
): number {
  const cw = pw ? pw - 2 * MRG : CW;
  const idx = options?.rowIndex ?? 0;
  const bg = idx % 2 === 0 ? WHITE : GRAY_LIGHT;
  p.drawRectangle({ x: MRG, y: y - ROW_HEIGHT, width: cw, height: ROW_HEIGHT, color: bg });
  // Bottom grid line
  p.drawLine({ start: { x: MRG, y: y - ROW_HEIGHT }, end: { x: MRG + cw, y: y - ROW_HEIGHT }, thickness: 0.3, color: GRAY_LINE });

  let x = MRG + 3;
  cells.forEach((c, i) => {
    const align = aligns?.[i] ?? "left";
    const color = options?.cellColors?.[i] ?? BLACK;
    const font = (options?.boldCols?.includes(i) && options?.bold) ? options.bold : reg;
    const text = String(c).slice(0, 30);
    const tw = font.widthOfTextAtSize(text, FONT_TABLE);
    let tx = x;
    if (align === "right") tx = x + widths[i] - tw - 6;
    else if (align === "center") tx = x + (widths[i] - tw) / 2;
    p.drawText(text, { x: tx, y: y - ROW_HEIGHT + 4, size: FONT_TABLE, font, color });
    x += widths[i];
  });
  return y - ROW_HEIGHT;
}

// ── Totals Row (brand deep bg) ──────────────────────────────────────

export function drawTotalsRow(
  p: PDFPage,
  bold: PDFFont,
  y: number,
  cells: string[],
  widths: number[],
  aligns?: ColAlign[],
  pw?: number
): number {
  const cw = pw ? pw - 2 * MRG : CW;
  const h = ROW_HEIGHT + 2;
  p.drawRectangle({ x: MRG, y: y - h, width: cw, height: h, color: BRAND_DEEP });
  let x = MRG + 3;
  cells.forEach((c, i) => {
    const align = aligns?.[i] ?? "left";
    const text = String(c).slice(0, 30);
    const tw = bold.widthOfTextAtSize(text, FONT_TABLE_HD);
    let tx = x;
    if (align === "right") tx = x + widths[i] - tw - 6;
    else if (align === "center") tx = x + (widths[i] - tw) / 2;
    p.drawText(text, { x: tx, y: y - h + 5, size: FONT_TABLE_HD, font: bold, color: WHITE });
    x += widths[i];
  });
  return y - h;
}

// ── Moyennes Row (coral bg) ─────────────────────────────────────────

export function drawMoyennesRow(
  p: PDFPage,
  bold: PDFFont,
  y: number,
  cells: string[],
  widths: number[],
  aligns?: ColAlign[],
  pw?: number
): number {
  const cw = pw ? pw - 2 * MRG : CW;
  const h = ROW_HEIGHT + 2;
  p.drawRectangle({ x: MRG, y: y - h, width: cw, height: h, color: CORAL });
  let x = MRG + 3;
  cells.forEach((c, i) => {
    const align = aligns?.[i] ?? "left";
    const text = String(c).slice(0, 30);
    const tw = bold.widthOfTextAtSize(text, FONT_TABLE_HD);
    let tx = x;
    if (align === "right") tx = x + widths[i] - tw - 6;
    else if (align === "center") tx = x + (widths[i] - tw) / 2;
    p.drawText(text, { x: tx, y: y - h + 5, size: FONT_TABLE_HD, font: bold, color: WHITE });
    x += widths[i];
  });
  return y - h;
}

// ── KPI Row ─────────────────────────────────────────────────────────

export function drawKpiRow(
  p: PDFPage,
  bold: PDFFont,
  reg: PDFFont,
  y: number,
  label: string,
  value: string,
  valueColor?: RGB
): number {
  p.drawText(label, { x: MRG + 10, y, size: 9, font: reg, color: BLACK });
  p.drawText(value, { x: MRG + 280, y, size: 9, font: bold, color: valueColor ?? BRAND_DEEP });
  return y - 18;
}

// ── Empty Data Message ──────────────────────────────────────────────

export function drawEmptyMessage(
  p: PDFPage,
  font: PDFFont,
  y: number,
  message: string
): number {
  p.drawRectangle({ x: MRG, y: y - 30, width: CW, height: 32, color: BRAND_LIGHT });
  const tw = font.widthOfTextAtSize(message, 9);
  p.drawText(message, { x: MRG + (CW - tw) / 2, y: y - 20, size: 9, font, color: GRAY });
  return y - 40;
}

// ── Subtitle text below section header ──────────────────────────────

export function drawSubText(
  p: PDFPage,
  reg: PDFFont,
  y: number,
  text: string
): number {
  p.drawText(text, { x: MRG + 6, y, size: 8, font: reg, color: GRAY });
  return y - 14;
}
