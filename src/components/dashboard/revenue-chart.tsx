"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { MonthlyRevenue } from "@/actions/analytics";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

function formatAmount(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}

export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  if (data.every((d) => d.revenue === 0)) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucune facture sur les 12 derniers mois
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={formatAmount}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [`${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`, "Revenus TTC"]}
          cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }}
        />
        <Bar dataKey="revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
