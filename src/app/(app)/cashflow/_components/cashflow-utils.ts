// Helpers et constantes partagés par les sous-composants de la page cashflow.

export const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
  padding: "12px 16px",
};

export function fmtK(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}
