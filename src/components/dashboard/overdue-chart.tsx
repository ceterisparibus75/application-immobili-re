"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { OverdueByAge } from "@/actions/analytics";

const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #E2E8F0",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#0C2340",
  boxShadow: "0 4px 16px rgba(12, 35, 64, 0.08)",
};

// Couleurs désaturées pastels → plus saturées selon l'ancienneté
const BUCKET_COLORS = ["#FCD34D", "#FB923C", "#F87171", "#B91C1C"];

export function OverdueChart({ data }: { data: OverdueByAge[] }) {
  const hasData = data.some((d) => d.amount > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucun impayé en cours
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#64748B" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
          tick={{ fontSize: 11, fill: "#64748B" }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [
            `${Number(v ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} \u20AC`,
            "Impayés",
          ]}
          cursor={{ fill: "#FEF2F2", opacity: 0.5 }}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
