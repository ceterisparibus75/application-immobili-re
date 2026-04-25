"use client";

export function ConfidenceGauge({ value }: { value: number }) {
  // Normaliser : si l'IA retourne 75 au lieu de 0.75, corriger
  const normalized = value > 1 ? value / 100 : value;
  const percentage = Math.round(normalized * 100);

  const color =
    percentage >= 75 ? "text-[var(--color-status-positive)]" :
    percentage >= 50 ? "text-[var(--color-status-caution)]" :
    "text-[var(--color-status-negative)]";

  const bgColor =
    percentage >= 75 ? "bg-[var(--color-status-positive-bg)]" :
    percentage >= 50 ? "bg-[var(--color-status-caution-bg)]" :
    "bg-[var(--color-status-negative-bg)]";

  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 ${bgColor}`}>
      <div className="relative h-10 w-10">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-black/5"
            d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className={color}
            d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${percentage}, 100`}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${color}`}>
          {percentage}%
        </span>
      </div>
      <div>
        <p className="text-xs font-semibold text-[var(--color-brand-deep)]">Confiance IA</p>
        <p className={`text-[10px] font-medium ${color}`}>
          {percentage >= 75
            ? "Élevé — données suffisantes, comparables nombreux"
            : percentage >= 50
              ? "Modéré — données partielles, à confirmer par un expert"
              : "Faible — peu de données, estimation indicative uniquement"}
        </p>
      </div>
    </div>
  );
}
