import { rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import {
  pushGraphicsState,
  popGraphicsState,
  setFillingColor,
  moveTo,
  lineTo,
  closePath,
  fill,
} from "pdf-lib";
import { BLACK, CHART_COLORS, FONT_SMALL } from "./constants";

/**
 * Draw a single pie slice using polygon fan approximation.
 */
function drawPieSlice(
  page: PDFPage,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: RGB
): void {
  const steps = Math.max(2, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 36)));
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }

  page.pushOperators(
    pushGraphicsState(),
    setFillingColor(color),
    moveTo(cx, cy),
    ...points.map(([x, y]) => lineTo(x, y)),
    closePath(),
    fill(),
    popGraphicsState()
  );
}

export interface PieSlice {
  value: number;
  label: string;
  color?: RGB;
}

/**
 * Draw a pie chart with legend.
 * Returns the Y position after the chart + legend.
 */
export function drawPieChart(
  page: PDFPage,
  cx: number,
  cy: number,
  radius: number,
  slices: PieSlice[],
  font: PDFFont,
  boldFont: PDFFont
): number {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return cy - radius - 20;

  let currentAngle = -Math.PI / 2; // Start from top

  slices.forEach((slice, i) => {
    const color = slice.color ?? CHART_COLORS[i % CHART_COLORS.length];
    const sliceAngle = (slice.value / total) * 2 * Math.PI;

    if (sliceAngle > 0.01) {
      drawPieSlice(page, cx, cy, radius, currentAngle, currentAngle + sliceAngle, color);

      // Percentage label at midpoint
      if (sliceAngle > 0.15) {
        const midAngle = currentAngle + sliceAngle / 2;
        const labelR = radius * 0.65;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);
        const pct = ((slice.value / total) * 100).toFixed(1) + "%";
        const tw = boldFont.widthOfTextAtSize(pct, FONT_SMALL);
        page.drawText(pct, {
          x: lx - tw / 2,
          y: ly - 3,
          size: FONT_SMALL,
          font: boldFont,
          color: rgb(1, 1, 1),
        });
      }
    }

    currentAngle += sliceAngle;
  });

  // Legend below chart
  let legendY = cy - radius - 18;
  slices.forEach((slice, i) => {
    const color = slice.color ?? CHART_COLORS[i % CHART_COLORS.length];
    const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : "0.0";
    page.drawRectangle({ x: cx - radius, y: legendY - 2, width: 8, height: 8, color });
    page.drawText(`${slice.label} (${pct}%)`, {
      x: cx - radius + 12,
      y: legendY,
      size: FONT_SMALL,
      font,
      color: BLACK,
    });
    legendY -= 13;
  });

  return legendY - 5;
}

/**
 * Draw a horizontal bar chart.
 * Returns the Y position after the chart.
 */
export function drawBarChart(
  page: PDFPage,
  x: number,
  y: number,
  maxWidth: number,
  bars: { label: string; value: number; color?: RGB }[],
  font: PDFFont,
  boldFont: PDFFont
): number {
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const barHeight = 14;
  const gap = 6;
  let curY = y;

  bars.forEach((bar, i) => {
    const color = bar.color ?? CHART_COLORS[i % CHART_COLORS.length];
    const barW = Math.max(2, (bar.value / maxVal) * maxWidth);

    // Label
    page.drawText(bar.label, { x, y: curY, size: FONT_SMALL, font, color: BLACK });
    curY -= 12;

    // Bar
    page.drawRectangle({ x, y: curY, width: barW, height: barHeight, color });

    // Value on bar
    const valStr = bar.value.toFixed(1) + "%";
    page.drawText(valStr, {
      x: x + barW + 4,
      y: curY + 3,
      size: FONT_SMALL,
      font: boldFont,
      color: BLACK,
    });

    curY -= barHeight + gap;
  });

  return curY;
}
