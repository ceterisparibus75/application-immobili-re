"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { getCashflowForecast } from "@/actions/cashflow";
import type { CashflowMonth } from "@/actions/cashflow";
import { formatCurrency } from "@/lib/utils";

const PERIODS = [
  { label: "6 mois", value: 6 },
  { label: "12 mois", value: 12 },
  { label: "24 mois", value: 24 },
] as const;

const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #E2E8F0",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#0C2340",
  boxShadow: "0 4px 16px rgba(12, 35, 64, 0.08)",
};

function formatAmount(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)} k\u20AC`;
  return `${v.toFixed(0)} \u20AC`;
}

export default function CashflowPage() {
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;

  const [period, setPeriod] = useState<number>(12);
  const [data, setData] = useState<CashflowMonth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!societyId) return;
    startTransition(async () => {
      const result = await getCashflowForecast(societyId, period);
      if (result.success && result.data) {
        setData(result.data.months);
        setError(null);
      } else {
        setError(result.error ?? "Erreur inconnue");
        setData([]);
      }
    });
  }, [societyId, period]);

  // Compute KPIs from the future months only (those without actualIncome)
  const futureMonths = data.filter((m) => m.actualIncome === undefined);
  const totalProjectedIncome = futureMonths.reduce((s, m) => s + m.projectedIncome, 0);
  const totalProjectedExpenses = futureMonths.reduce((s, m) => s + m.projectedExpenses, 0);
  const totalNetCashflow = futureMonths.reduce((s, m) => s + m.netCashflow, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/comptabilite">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Cash-flow prévisionnel</h1>
            <p className="text-sm text-muted-foreground">
              Projection des revenus et dépenses sur {period} mois
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Calcul en cours...</span>
        </div>
      )}

      {!isPending && data.length > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-[var(--color-status-positive)] flex-shrink-0" />
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(totalProjectedIncome)}</div>
                  <div className="text-xs text-muted-foreground">
                    Revenus projetés ({period} mois)
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-[var(--color-status-negative)] flex-shrink-0" />
                <div>
                  <div className="text-2xl font-bold">{formatCurrency(totalProjectedExpenses)}</div>
                  <div className="text-xs text-muted-foreground">
                    Dépenses projetées ({period} mois)
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Wallet className="h-8 w-8 text-blue-600 flex-shrink-0" />
                <div>
                  <div className={`text-2xl font-bold ${totalNetCashflow >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}>
                    {formatCurrency(totalNetCashflow)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Cash-flow net ({period} mois)
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Évolution mensuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" />
                      <stop offset="100%" stopColor="#86EFAC" />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A04040" />
                      <stop offset="100%" stopColor="#FCA5A5" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={formatAmount}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v, name) => {
                      const label =
                        name === "projectedIncome"
                          ? "Revenus prévus"
                          : name === "projectedExpenses"
                            ? "Dépenses prévues"
                            : name === "netCashflow"
                              ? "Cash-flow net"
                              : name === "actualIncome"
                                ? "Revenus réels"
                                : "Dépenses réelles";
                      return [formatCurrency(Number(v)), label];
                    }}
                    cursor={{ fill: "#F0F9FF", opacity: 0.6 }}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "projectedIncome"
                        ? "Revenus prévus"
                        : value === "projectedExpenses"
                          ? "Dépenses prévues"
                          : value === "netCashflow"
                            ? "Cash-flow net"
                            : value === "actualIncome"
                              ? "Revenus réels"
                              : "Dépenses réelles"
                    }
                  />
                  <Bar
                    dataKey="projectedIncome"
                    fill="url(#incomeGrad)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="projectedExpenses"
                    fill="url(#expenseGrad)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    type="monotone"
                    dataKey="netCashflow"
                    stroke="#1B4F8A"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détail mensuel</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mois</TableHead>
                      <TableHead className="text-right">Revenus prévus</TableHead>
                      <TableHead className="text-right">Dépenses prévues</TableHead>
                      <TableHead className="text-right">Cash-flow net</TableHead>
                      <TableHead className="text-right">Revenus réels</TableHead>
                      <TableHead className="text-right">Dépenses réelles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => {
                      const isHistorical = row.actualIncome !== undefined;
                      return (
                        <TableRow
                          key={row.month}
                          className={isHistorical ? "bg-muted/30" : undefined}
                        >
                          <TableCell className="font-medium">{row.month}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(row.projectedIncome)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(row.projectedExpenses)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-sm font-semibold ${
                              row.netCashflow >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"
                            }`}
                          >
                            {formatCurrency(row.netCashflow)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {row.actualIncome !== undefined
                              ? formatCurrency(row.actualIncome)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {row.actualExpenses !== undefined
                              ? formatCurrency(row.actualExpenses)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!isPending && data.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune donnée disponible. Vérifiez que des baux actifs existent pour cette société.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
