"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMonthData = {
  month: string;    // "janv.", "févr.", etc.
  facture: number;  // montant facturé TTC
  paye: number;     // montant payé
};

// ─── Composant ────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white p-3 shadow-lg text-xs space-y-1.5">
      <p className="font-semibold text-[#0C2340] mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </span>
          <span className="font-semibold tabular-nums">
            {p.value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TenantPaymentChart({ data }: { data: PaymentMonthData[] }) {
  if (data.length === 0 || data.every((d) => d.facture === 0 && d.paye === 0)) {
    return null;
  }

  const hasAnyPaid = data.some((d) => d.paye > 0);
  const totalFacture = data.reduce((s, d) => s + d.facture, 0);
  const totalPaye = data.reduce((s, d) => s + d.paye, 0);
  const tauxRecouvrement = totalFacture > 0 ? Math.round((totalPaye / totalFacture) * 100) : 0;

  return (
    <Card className="border-0 shadow-brand bg-white rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-brand-deep)]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F0F9FF]">
              <TrendingUp className="h-4 w-4 text-[#1B4F8A]" />
            </div>
            Historique des paiements
          </CardTitle>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Taux de recouvrement</p>
            <p
              className="text-lg font-bold tabular-nums"
              style={{
                color:
                  tauxRecouvrement >= 95
                    ? "var(--color-status-positive)"
                    : tauxRecouvrement >= 75
                      ? "var(--color-status-caution)"
                      : "var(--color-status-negative)",
              }}
            >
              {tauxRecouvrement}%
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barSize={14} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
              width={35}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
            <Bar dataKey="facture" name="Facturé" fill="#1B4F8A" opacity={0.3} radius={[2, 2, 0, 0]} />
            {hasAnyPaid && (
              <Bar dataKey="paye" name="Encaissé" fill="var(--color-status-positive)" radius={[2, 2, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
