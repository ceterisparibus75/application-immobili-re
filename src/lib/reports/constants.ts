import { rgb } from "pdf-lib";

// ── MyGestia Brand Colors ─────────────────────────────────────────
export const BRAND_DEEP  = rgb(0.047, 0.137, 0.251); // #0C2340
export const BRAND_BLUE  = rgb(0.106, 0.310, 0.541); // #1B4F8A
export const BRAND_CYAN  = rgb(0.133, 0.722, 0.812); // #22B8CF
export const BRAND_LIGHT = rgb(0.878, 0.969, 0.980); // #E0F7FA

// ── Semantic Colors ───────────────────────────────────────────────
export const CORAL       = rgb(0.85, 0.25, 0.20);    // #D94033
export const CORAL_LIGHT = rgb(0.98, 0.92, 0.91);
export const GREEN       = rgb(0.13, 0.55, 0.27);
export const WHITE       = rgb(1, 1, 1);
export const BLACK       = rgb(0.13, 0.13, 0.13);
export const GRAY        = rgb(0.55, 0.55, 0.55);
export const GRAY_LIGHT  = rgb(0.95, 0.95, 0.95);
export const GRAY_LINE   = rgb(0.82, 0.82, 0.82);

// ── Chart Palette (8 distinct colors for pie/bar charts) ──────────
export const CHART_COLORS = [
  BRAND_DEEP,
  BRAND_CYAN,
  CORAL,
  rgb(0.40, 0.73, 0.42),  // green
  rgb(0.95, 0.65, 0.15),  // orange
  rgb(0.58, 0.40, 0.74),  // purple
  rgb(0.36, 0.60, 0.78),  // steel blue
  rgb(0.80, 0.47, 0.65),  // mauve
];

// ── Layout Constants ──────────────────────────────────────────────
export const PW  = 595.28;          // A4 width (pt)
export const PH  = 841.89;          // A4 height (pt)
export const MRG = 50;              // margins (audit-firm standard)
export const CW  = PW - 2 * MRG;   // content width = 495.28

// Landscape
export const LPW = PH;             // landscape width
export const LPH = PW;             // landscape height
export const LCW = LPW - 2 * MRG; // landscape content width

// Typography
export const FONT_TITLE      = 18;
export const FONT_SUBTITLE   = 12;
export const FONT_SECTION    = 11;
export const FONT_TABLE_HD   = 7;
export const FONT_TABLE      = 7;
export const FONT_FOOTER     = 6.5;
export const FONT_SMALL      = 6;

// Row heights
export const ROW_HEIGHT      = 16;
export const SECTION_HEIGHT  = 22;
export const HEADER_HEIGHT   = 50;
export const COVER_SIDEBAR_W = 180;
