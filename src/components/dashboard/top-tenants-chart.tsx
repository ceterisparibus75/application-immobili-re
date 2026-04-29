"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { TopTenant } from "@/actions/analytics";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
};

export function TopTenantsChart({ data }: { data: TopTenant[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucune facture enregistrée
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="tenantGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1B4F8A" />
            <stop offset="100%" stopColor="#22B8CF" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [
            `${Number(v ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} \u20AC`,
            "CA Total",
          ]}
          cursor={{ fill: "var(--accent)", opacity: 0.5 }}
        />
        <Bar dataKey="total" fill="url(#tenantGrad)" radius={[0, 4, 4, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
