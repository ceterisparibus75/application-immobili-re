import type { PatrimonyPoint } from "@/actions/analytics";

function formatValue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M\u20AC`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)} k\u20AC`;
  return `${v.toFixed(0)} \u20AC`;
}

const CHART = { width: 360, height: 200, top: 12, right: 12, bottom: 30, left: 58 };

export function PatrimonyChart({ data }: { data: PatrimonyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Renseignez la valeur vénale ou le prix d&apos;acquisition des immeubles
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const points = data.map((item, index) => {
    const x = CHART.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const y = CHART.top + plotHeight - ((item.value - min) / range) * plotHeight;
    return { ...item, x, y };
  });
  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = [
    `${points[0].x},${CHART.top + plotHeight}`,
    linePoints,
    `${points[points.length - 1].x},${CHART.top + plotHeight}`,
  ].join(" ");
  const ticks = [min, min + range / 2, max];

  return (
    <svg
      className="h-[200px] w-full overflow-visible"
      viewBox={`0 0 ${CHART.width} ${CHART.height}`}
      role="img"
      aria-label="Évolution de la valeur cumulée du patrimoine"
    >
      <defs>
        <linearGradient id="patrimonyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.2} />
          <stop offset="50%" stopColor="#22B8CF" stopOpacity={0.08} />
          <stop offset="95%" stopColor="#22B8CF" stopOpacity={0} />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const y = CHART.top + plotHeight - ((tick - min) / range) * plotHeight;
        return (
          <g key={tick}>
            <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
            <text x={CHART.left - 8} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {formatValue(tick)}
            </text>
          </g>
        );
      })}
      <polygon points={areaPoints} fill="url(#patrimonyGrad)" />
      <polyline points={linePoints} fill="none" stroke="#1B4F8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point) => (
        <g key={point.date}>
          <title>{`${point.date}: ${formatValue(point.value)}`}</title>
          <circle cx={point.x} cy={point.y} r="3" fill="#1B4F8A" />
          <text x={point.x} y={CHART.height - 10} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {point.date}
          </text>
        </g>
      ))}
    </svg>
  );
}
