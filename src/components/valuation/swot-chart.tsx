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
      <SwotQuadrant title="Forces" items={strengths} bgClass="bg-green-50 dark:bg-green-950/30" textClass="text-green-800 dark:text-green-300" />
      <SwotQuadrant title="Faiblesses" items={weaknesses} bgClass="bg-yellow-50 dark:bg-yellow-950/30" textClass="text-yellow-800 dark:text-yellow-300" />
      <SwotQuadrant title="Opportunités" items={opportunities} bgClass="bg-blue-50 dark:bg-blue-950/30" textClass="text-blue-800 dark:text-blue-300" />
      <SwotQuadrant title="Menaces" items={threats} bgClass="bg-red-50 dark:bg-red-950/30" textClass="text-red-800 dark:text-red-300" />
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
    <div className={`rounded-md p-2.5 ${bgClass}`}>
      <p className={`font-semibold mb-1 ${textClass}`}>{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-0.5">
          {items.slice(0, 4).map((item, i) => (
            <li key={i} className={`${textClass} opacity-80`}>• {item}</li>
          ))}
          {items.length > 4 && (
            <li className={`${textClass} opacity-60`}>+ {items.length - 4} autre(s)</li>
          )}
        </ul>
      ) : (
        <p className={`${textClass} opacity-50`}>Aucun</p>
      )}
    </div>
  );
}
