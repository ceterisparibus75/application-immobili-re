"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { BuildingOccupancy } from "@/actions/analytics";

const COLORS_OCC = ["#22c55e", "#f59e0b"];
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

interface Props {
  data: BuildingOccupancy[];
  globalRate: number;
}

export function OccupancyChart({ data, globalRate }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucun immeuble avec des lots
      </div>
    );
  }

  const totalOccupied = data.reduce((s, b) => s + b.occupied, 0);
  const totalVacant = data.reduce((s, b) => s + b.vacant, 0);
  const pieData = [
    { name: "Occupés", value: totalOccupied },
    { name: "Vacants", value: totalVacant },
  ];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS_OCC[i % COLORS_OCC.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => { const n = Number(v); return [`${n} lot${n > 1 ? "s" : ""}`, ""]; }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Taux global au centre */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 pointer-events-none" style={{ marginTop: "-28px" }}>
        <p className="text-2xl font-bold text-center leading-none">{globalRate}%</p>
        <p className="text-xs text-muted-foreground text-center mt-0.5">global</p>
      </div>
      {/* Breakdown par immeuble */}
      {data.length > 1 && (
        <div className="mt-2 space-y-1">
          {data.map((b) => (
            <div key={b.name} className="flex items-center gap-2 text-xs">
              <span className="truncate flex-1 text-muted-foreground">{b.name}</span>
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${b.rate}%` }} />
              </div>
              <span className="w-8 text-right font-medium">{b.rate}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
