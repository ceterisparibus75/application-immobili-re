import type { OverdueByAge } from "@/actions/analytics";

// Couleurs désaturées pastels → plus saturées selon l'ancienneté
const BUCKET_COLORS = ["#C4A96A", "#B08650", "#A04040", "#7A2020"];
const CHART = { width: 360, height: 200, top: 12, right: 10, bottom: 30, left: 46 };

export function OverdueChart({ data }: { data: OverdueByAge[] }) {
  const hasData = data.some((d) => d.amount > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucun impayé en cours
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.amount), 1);
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const gap = 16;
  const barWidth = Math.max(34, (plotWidth - gap * (data.length - 1)) / data.length);
  const ticks = [0, max / 2, max];

  return (
    <svg
      className="h-[200px] w-full overflow-visible"
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label="Montants impayés par ancienneté"
    >
      {ticks.map((tick) => {
        const y = CHART.top + plotHeight - (tick / max) * plotHeight;
        const label = tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0);
        return (
          <g key={tick}>
            <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={CHART.left - 8} y={y + 4} textAnchor="end" fill="currentColor" className="text-muted-foreground text-[11px]">
              {label}
            </text>
          </g>
        );
      })}
      {data.map((item, index) => {
        const x = CHART.left + index * (barWidth + gap);
        const height = Math.max(2, (item.amount / max) * plotHeight);
        const y = CHART.top + plotHeight - height;
        return (
          <g key={item.label}>
            <title>{`${item.label}: ${item.amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} \u20AC`}</title>
            <rect x={x} y={y} width={barWidth} height={height} rx={4} fill={BUCKET_COLORS[index % BUCKET_COLORS.length]} />
            <text x={x + barWidth / 2} y={CHART.height - 10} textAnchor="middle" fill="currentColor" className="text-muted-foreground text-[11px]">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
