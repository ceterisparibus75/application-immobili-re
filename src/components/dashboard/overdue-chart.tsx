"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { OverdueByAge } from "@/actions/analytics";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

// Couleurs de plus en plus rouges selon l'anciennete
const BUCKET_COLORS = ["#f59e0b", "#f97316", "#ef4444", "#991b1b"];

export function OverdueChart({ data }: { data: OverdueByAge[] }) {
  const hasData = data.some((d) => d.amount > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucun impayet en cours
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [
            `${Number(v ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`,
            "Impayes",
          ]}
          cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }}
        />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
