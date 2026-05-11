"use client";

import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { TOOLTIP_STYLE } from "./cashflow-utils";

export function BreakdownCard({ title, subtitle, data, total, emptyMessage, monthCount, type }: {
  title: string;
  subtitle: string;
  data: Array<{ categoryId: string; label: string; color: string; amount: number; percentage: number }>;
  total: number;
  emptyMessage: string;
  monthCount: number;
  type: "expense" | "income";
}) {
  return (
    <Card className="border-0 shadow-brand bg-card rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-bold tabular-nums ${
            type === "expense" ? "text-[var(--color-status-negative)]" : "text-[var(--color-status-positive)]"
          }`}>
            {type === "expense" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
            {formatCurrency(total)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Pie chart compact */}
            <div className="flex justify-center">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={48}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.categoryId} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v, name) => [formatCurrency(Number(v)), String(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Légende détaillée */}
            <div className="space-y-2">
              {data.map((b) => (
                <div key={b.categoryId} className="flex items-center gap-2.5 group">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="flex-1 text-sm truncate text-foreground group-hover:text-foreground">
                    {b.label}
                  </span>
                  <span className="font-mono text-xs tabular-nums font-semibold">
                    {formatCurrency(b.amount)}
                  </span>
                  <span className="text-[10px] text-muted-foreground w-9 text-right tabular-nums">
                    {b.percentage}%
                  </span>
                </div>
              ))}
            </div>

            {/* Moyenne mensuelle */}
            <div className="border-t pt-3 mt-1">
              <p className="text-xs text-muted-foreground text-center">
                Moyenne mensuelle : <span className="font-semibold text-foreground">{formatCurrency(total / monthCount)}</span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
