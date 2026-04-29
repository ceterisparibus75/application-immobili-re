import type { MonthlyRevenue } from "@/actions/analytics";

function formatAmount(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)} k\u20AC`;
  return `${v.toFixed(0)} \u20AC`;
}

const CHART = { width: 640, height: 200, top: 12, right: 12, bottom: 34, left: 58 };

export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  if (data.every((d) => d.revenue === 0)) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucune facture sur les 12 derniers mois
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const gap = 8;
  const barWidth = Math.max(12, (plotWidth - gap * (data.length - 1)) / data.length);
  const ticks = [0, max / 2, max];

  return (
    <svg
      className="h-[200px] w-full overflow-visible"
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label="Revenus TTC sur les 12 derniers mois"
    >
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1B4F8A" />
            <stop offset="100%" stopColor="#22B8CF" />
          </linearGradient>
        </defs>
      {ticks.map((tick) => {
        const y = CHART.top + plotHeight - (tick / max) * plotHeight;
        return (
          <g key={tick}>
            <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={CHART.left - 10} y={y + 4} textAnchor="end" fill="currentColor" className="text-muted-foreground text-[11px]">
              {formatAmount(tick)}
            </text>
          </g>
        );
      })}
      {data.map((item, index) => {
        const x = CHART.left + index * (barWidth + gap);
        const height = Math.max(2, (item.revenue / max) * plotHeight);
        const y = CHART.top + plotHeight - height;
        return (
          <g key={item.month}>
            <title>{`${item.month}: ${item.revenue.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} \u20AC TTC`}</title>
            <rect x={x} y={y} width={barWidth} height={height} rx={4} fill="url(#revenueGrad)" />
            <text x={x + barWidth / 2} y={CHART.height - 12} textAnchor="middle" fill="currentColor" className="text-muted-foreground text-[11px]">
              {item.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
