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

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (globalRate / 100) * circumference;

  // Couleur du donut selon le taux
  const donutColor = globalRate >= 80 ? "#4A7C6F" : globalRate >= 50 ? "#9B7A3C" : "#A04040";

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
              stroke="#F1F5F9"
              strokeWidth="8"
            />
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke={donutColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold tabular-nums leading-none text-[#0C2340]">{globalRate}%</span>
          </div>
        </div>

        {/* Chiffres clés */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Occupés</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--color-status-positive)]">{totalOccupied}</p>
            <p className="text-[10px] text-muted-foreground">lot{totalOccupied > 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vacants</p>
            <p className="text-lg font-semibold tabular-nums text-[var(--color-status-caution)]">{totalVacant}</p>
            <p className="text-[10px] text-muted-foreground">lot{totalVacant > 1 ? "s" : ""} sur {totalLots}</p>
          </div>
        </div>
      </div>

      {/* Détail par immeuble */}
      {data.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-gray-100">
          {data.map((b) => {
            const total = b.occupied + b.vacant;
            return (
              <div key={b.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate max-w-[65%] text-[#0C2340]">{b.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {b.occupied}/{total} — <span className={b.rate >= 80 ? "text-[var(--color-status-positive)] font-semibold" : b.rate >= 50 ? "text-[var(--color-status-caution)] font-semibold" : "text-[var(--color-status-negative)] font-semibold"}>{b.rate}%</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden flex">
                  {b.occupied > 0 && (
                    <div
                      className="h-full bg-[var(--color-status-positive)] transition-all duration-300"
                      style={{ width: `${b.rate}%` }}
                    />
                  )}
                  {b.vacant > 0 && (
                    <div
                      className="h-full bg-[var(--color-status-caution-bg)] transition-all duration-300"
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
