"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { PatrimonyPoint } from "@/actions/analytics";

const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #E2E8F0",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#0C2340",
  boxShadow: "0 4px 16px rgba(12, 35, 64, 0.08)",
};

function formatValue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M\u20AC`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)} k\u20AC`;
  return `${v.toFixed(0)} \u20AC`;
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
            <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.2} />
            <stop offset="50%" stopColor="#22B8CF" stopOpacity={0.08} />
            <stop offset="95%" stopColor="#22B8CF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#64748B" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={formatValue}
          tick={{ fontSize: 11, fill: "#64748B" }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [formatValue(Number(v)), "Valeur patrimoine"]}
          cursor={{ stroke: "#E2E8F0", strokeDasharray: "3 3" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#1B4F8A"
          strokeWidth={2}
          fill="url(#patrimonyGrad)"
          dot={{ fill: "#1B4F8A", r: 3, strokeWidth: 0 }}
          activeDot={{ fill: "#22B8CF", r: 5, strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
