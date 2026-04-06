"use client";

interface SwotChartProps {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export function SwotChart({ strengths, weaknesses, opportunities, threats }: SwotChartProps) {
  if (!strengths.length && !weaknesses.length && !opportunities.length && !threats.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <SwotQuadrant
        title="Forces"
        items={strengths}
        bgClass="bg-[var(--color-status-positive-bg)]"
        textClass="text-[var(--color-status-positive)]"
      />
      <SwotQuadrant
        title="Faiblesses"
        items={weaknesses}
        bgClass="bg-[var(--color-status-caution-bg)]"
        textClass="text-[var(--color-status-caution)]"
      />
      <SwotQuadrant
        title="Opportunités"
        items={opportunities}
        bgClass="bg-[var(--color-brand-light)]"
        textClass="text-[var(--color-brand-blue)]"
      />
      <SwotQuadrant
        title="Menaces"
        items={threats}
        bgClass="bg-[var(--color-status-negative-bg)]"
        textClass="text-[var(--color-status-negative)]"
      />
    </div>
  );
}

function SwotQuadrant({
  title,
  items,
  bgClass,
  textClass,
}: {
  title: string;
  items: string[];
  bgClass: string;
  textClass: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${bgClass}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${textClass}`}>{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-0.5">
          {items.slice(0, 4).map((item, i) => (
            <li key={i} className={`text-[11px] ${textClass} opacity-80`}>- {item}</li>
          ))}
          {items.length > 4 && (
            <li className={`text-[10px] ${textClass} opacity-60`}>+ {items.length - 4} autre(s)</li>
          )}
        </ul>
      ) : (
        <p className={`text-[10px] ${textClass} opacity-50`}>Aucun</p>
      )}
    </div>
  );
}
