"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DebtProfile } from "@/lib/loan-debt-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CalendarClock, TrendingDown } from "lucide-react";

const URGENCY_COLOR: Record<"critical" | "soon" | "normal", string> = {
  critical: "var(--color-status-negative)",
  soon: "var(--color-status-caution)",
  normal: "var(--color-brand-blue)",
};

const URGENCY_LABEL: Record<"critical" | "soon" | "normal", string> = {
  critical: "< 1 an",
  soon: "1 – 3 ans",
  normal: "> 3 ans",
};

const URGENCY_BADGE: Record<"critical" | "soon" | "normal", "destructive" | "secondary" | "default"> = {
  critical: "destructive",
  soon: "secondary",
  normal: "default",
};

function fmtMonth(key: string): string {
  const [year, month] = key.split("-");
  const m = new Date(Number(year), Number(month) - 1, 1);
  return m.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
};

function ExtinctionTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label ? fmtMonth(label) : ""}</p>
      <p className="tabular-nums text-destructive">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function DebtProfileChart({ profile }: { profile: DebtProfile }) {
  if (profile.timeline.length === 0) return null;

  // Filtrer la courbe pour n'afficher qu'un tick par trimestre sur l'axe X
  const curveData = profile.extinctionCurve.map((p) => ({
    ...p,
    label: fmtMonth(p.month),
  }));

  // Ticks X : 1 point tous les 3 mois
  const xTicks = curveData
    .filter((_, i) => i % 3 === 0)
    .map((p) => p.month);

  const maxCrd = Math.max(...curveData.map((p) => p.totalCrd));
  const yMax = Math.ceil(maxCrd / 100_000) * 100_000;

  // Trier la frise par urgence puis par mois restants
  const sortedTimeline = [...profile.timeline].sort((a, b) => {
    const order = { critical: 0, soon: 1, normal: 2 };
    return order[a.urgency] - order[b.urgency] || a.monthsRemaining - b.monthsRemaining;
  });

  const maxMonths = Math.max(...profile.timeline.map((l) => l.monthsRemaining), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Frise des emprunts — 2 colonnes */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Durée résiduelle</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedTimeline.map((loan) => {
            const color = URGENCY_COLOR[loan.urgency];
            const barPct = maxMonths > 0 ? (loan.monthsRemaining / maxMonths) * 100 : 0;
            const years = Math.floor(loan.monthsRemaining / 12);
            const months = loan.monthsRemaining % 12;
            const durationLabel =
              loan.monthsRemaining === 0
                ? "Ce mois"
                : years > 0
                ? `${years} an${years > 1 ? "s" : ""}${months > 0 ? ` ${months} m` : ""}`
                : `${loan.monthsRemaining} mois`;

            return (
              <div key={loan.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{loan.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{loan.lender}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(loan.currentCrd)}
                    </span>
                    <Badge variant={URGENCY_BADGE[loan.urgency]} className="text-[10px] px-1.5 py-0">
                      {URGENCY_LABEL[loan.urgency]}
                    </Badge>
                  </div>
                </div>
                <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barPct}%`, backgroundColor: color, opacity: 0.85 }}
                  />
                  <span
                    className="absolute right-1 top-0 text-[9px] leading-3 font-semibold"
                    style={{ color, lineHeight: "12px" }}
                  >
                    {durationLabel}
                  </span>
                </div>
              </div>
            );
          })}
          {/* Légende */}
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            {(["critical", "soon", "normal"] as const).map((u) => (
              <span key={u} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: URGENCY_COLOR[u] }}
                />
                {URGENCY_LABEL[u]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Courbe d extinction — 3 colonnes */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Extinction de la dette</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={curveData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="crdGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="month"
                ticks={xTicks}
                tickFormatter={fmtMonth}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, yMax]}
                tickFormatter={(v: number) =>
                  v === 0 ? "0" : `${Math.round(v / 1000)}k`
                }
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip content={<ExtinctionTooltip />} />
              <Area
                type="monotone"
                dataKey="totalCrd"
                stroke="var(--color-destructive)"
                strokeWidth={2}
                fill="url(#crdGradient)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}