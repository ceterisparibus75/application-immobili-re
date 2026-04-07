"use client";

import type { RiskConcentration } from "@/actions/analytics";
import { formatCurrency } from "@/lib/utils";

const HHI_THRESHOLDS = {
  LOW: 1500,   // < 1500 = diversifié
  MEDIUM: 2500, // 1500-2500 = modéré
  // > 2500 = concentré
};

function hhiLabel(hhi: number): { text: string; color: string } {
  if (hhi < HHI_THRESHOLDS.LOW) return { text: "Diversifié", color: "var(--color-status-positive)" };
  if (hhi < HHI_THRESHOLDS.MEDIUM) return { text: "Modéré", color: "var(--color-status-caution)" };
  return { text: "Concentré", color: "var(--color-status-negative)" };
}

function RiskBar({ items, hhi, label }: { items: { name: string; annualRent: number; pct: number }[]; hhi: number; label: string }) {
  const hhiInfo = hhiLabel(hhi);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-brand-deep)] uppercase tracking-wide">{label}</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: hhiInfo.color + "20", color: hhiInfo.color }}>
          {hhiInfo.text}
        </span>
      </div>

      {/* Barre de répartition */}
      <div className="flex h-5 rounded-md overflow-hidden">
        {items.map((item, i) => (
          <div
            key={item.name}
            className="relative group"
            style={{
              width: `${Math.max(item.pct, 2)}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
            title={`${item.name}: ${item.pct}%`}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/10 transition-opacity" />
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="truncate text-[var(--color-brand-deep)]">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-muted-foreground tabular-nums">{formatCurrency(item.annualRent)}/an</span>
              <span className="font-semibold tabular-nums w-[42px] text-right" style={{ color: item.pct > 50 ? "var(--color-status-negative)" : item.pct > 30 ? "var(--color-status-caution)" : "var(--color-brand-deep)" }}>
                {item.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLORS = [
  "#1B4F8A", "#22B8CF", "#4C9AFF", "#36B37E",
  "#FF8B00", "#6554C0", "#FF5630", "#00B8D9",
  "#8993A4", "#C1C7D0",
];

export function RiskConcentrationChart({ data }: { data: RiskConcentration }) {
  if (data.byBuilding.length === 0 && data.byTenant.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucun bail actif
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RiskBar items={data.byBuilding} hhi={data.hhiBuilding} label="Par immeuble" />
      <div className="border-t" />
      <RiskBar items={data.byTenant} hhi={data.hhiTenant} label="Par locataire" />
    </div>
  );
}
