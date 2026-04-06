"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Building2, Percent, Target } from "lucide-react";

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={Building2}
        label="Valeur vénale retenue"
        value={estimatedValueMid ? formatCurrency(estimatedValueMid) : "—"}
        subtext={
          estimatedValueLow && estimatedValueHigh
            ? `${formatCurrency(estimatedValueLow)} — ${formatCurrency(estimatedValueHigh)}`
            : undefined
        }
        color="text-blue-600"
      />
      <KpiCard
        icon={TrendingUp}
        label="Valeur locative annuelle"
        value={estimatedRentalValue ? formatCurrency(estimatedRentalValue) : "—"}
        color="text-green-600"
      />
      <KpiCard
        icon={Target}
        label="Prix au m²"
        value={pricePerSqm ? `${Math.round(pricePerSqm)} €/m²` : "—"}
        color="text-purple-600"
      />
      <KpiCard
        icon={Percent}
        label="Taux de capitalisation"
        value={capitalizationRate ? `${capitalizationRate.toFixed(1)} %` : "—"}
        color="text-orange-600"
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 bg-muted ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
