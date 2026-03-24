"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { PatrimonyPoint } from "@/actions/analytics";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

function formatValue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}

export function PatrimonyChart({ data }: { data: PatrimonyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Renseignez la valeur vénale ou le prix d&apos;acquisition des immeubles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="patrimonyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={formatValue}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [formatValue(Number(v)), "Valeur patrimoine"]}
          cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#patrimonyGrad)"
          dot={{ fill: "#8b5cf6", r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
