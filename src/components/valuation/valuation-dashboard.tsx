"use client";

import { formatCurrency } from "@/lib/utils";
import { Building2, TrendingUp, Target, Percent } from "lucide-react";

interface ValuationDashboardProps {
  estimatedValueMid: number | null;
  estimatedValueLow: number | null;
  estimatedValueHigh: number | null;
  estimatedRentalValue: number | null;
  pricePerSqm: number | null;
  capitalizationRate: number | null;
}

export function ValuationDashboard({
  estimatedValueMid,
  estimatedValueLow,
  estimatedValueHigh,
  estimatedRentalValue,
  pricePerSqm,
  capitalizationRate,
}: ValuationDashboardProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl p-5 shadow-brand">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)] shrink-0">
            <Building2 className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
          </div>
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Valeur vénale retenue</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">
          {estimatedValueMid ? formatCurrency(estimatedValueMid) : "—"}
        </p>
        {estimatedValueLow && estimatedValueHigh && (
          <p className="text-[10px] text-[#94A3B8] mt-1">
            {formatCurrency(estimatedValueLow)} — {formatCurrency(estimatedValueHigh)}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-brand">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)] shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
          </div>
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Valeur locative annuelle</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">
          {estimatedRentalValue ? formatCurrency(estimatedRentalValue) : "—"}
        </p>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-brand">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)] shrink-0">
            <Target className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
          </div>
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Prix au m²</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">
          {pricePerSqm ? `${Math.round(pricePerSqm)} €/m²` : "—"}
        </p>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-brand">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)] shrink-0">
            <Percent className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
          </div>
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Taux de capitalisation</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">
          {capitalizationRate ? `${capitalizationRate.toFixed(1)} %` : "—"}
        </p>
      </div>
    </div>
  );
}
