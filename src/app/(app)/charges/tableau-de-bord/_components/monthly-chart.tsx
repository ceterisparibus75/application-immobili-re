"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { MonthlyTotal } from "@/actions/charge-dashboard";
import { formatCurrency } from "@/lib/utils";

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

interface MonthlyChartProps {
  data: MonthlyTotal[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const chartData = data.map((d) => ({
    month: MONTH_LABELS[d.month - 1],
    total: d.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v}€`} width={60} />
        <Tooltip
          formatter={(value: unknown) => [formatCurrency(Number(value)), "Charges"]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="total" fill="var(--color-brand)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}