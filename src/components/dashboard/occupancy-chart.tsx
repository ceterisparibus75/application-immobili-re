"use client";

import type { BuildingOccupancy } from "@/actions/analytics";

interface Props {
  data: BuildingOccupancy[];
  globalRate: number;
}

export function OccupancyChart({ data, globalRate }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-sm text-muted-foreground">
        Aucun immeuble avec des lots
      </div>
    );
  }

  const totalOccupied = data.reduce((s, b) => s + b.occupied, 0);
  const totalVacant = data.reduce((s, b) => s + b.vacant, 0);
  const totalLots = totalOccupied + totalVacant;

  // Angle pour le cercle SVG (circumference = 2πr)
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (globalRate / 100) * circumference;

  return (
    <div className="space-y-4">
      {/* Résumé global */}
      <div className="flex items-center gap-5">
        {/* Mini donut SVG */}
        <div className="relative shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke={globalRate >= 80 ? "#22c55e" : globalRate >= 50 ? "#f59e0b" : "#ef4444"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold tabular-nums leading-none">{globalRate}%</span>
          </div>
        </div>

        {/* Chiffres clés */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Occupés</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600">{totalOccupied}</p>
            <p className="text-[10px] text-muted-foreground">lot{totalOccupied > 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vacants</p>
            <p className="text-lg font-bold tabular-nums text-amber-500">{totalVacant}</p>
            <p className="text-[10px] text-muted-foreground">lot{totalVacant > 1 ? "s" : ""} sur {totalLots}</p>
          </div>
        </div>
      </div>

      {/* Détail par immeuble */}
      {data.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t">
          {data.map((b) => {
            const total = b.occupied + b.vacant;
            return (
              <div key={b.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate max-w-[65%]">{b.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {b.occupied}/{total} — <span className={b.rate >= 80 ? "text-emerald-600 font-medium" : b.rate >= 50 ? "text-amber-600 font-medium" : "text-destructive font-medium"}>{b.rate}%</span>
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                  {b.occupied > 0 && (
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${b.rate}%` }}
                    />
                  )}
                  {b.vacant > 0 && (
                    <div
                      className="h-full bg-amber-400/50 transition-all duration-300"
                      style={{ width: `${100 - b.rate}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
