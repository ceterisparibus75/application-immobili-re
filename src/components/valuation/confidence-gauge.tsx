"use client";

export function ConfidenceGauge({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  const color =
    percentage >= 75 ? "text-green-600" :
    percentage >= 50 ? "text-yellow-600" :
    "text-red-600";

  const bgColor =
    percentage >= 75 ? "bg-green-100 dark:bg-green-950/30" :
    percentage >= 50 ? "bg-yellow-100 dark:bg-yellow-950/30" :
    "bg-red-100 dark:bg-red-950/30";

  return (
    <div className={`flex items-center gap-3 rounded-md p-2.5 ${bgColor}`}>
      <div className="relative h-10 w-10">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-muted-foreground/20"
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
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}>
          {percentage}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium">Score de confiance</p>
        <p className="text-xs text-muted-foreground">
          {percentage >= 75 ? "Élevé" : percentage >= 50 ? "Modéré" : "Faible"}
        </p>
      </div>
    </div>
  );
}
