"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, SelectSeparator,
} from "@/components/ui/select";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Loader2,
  AlertTriangle, Sparkles, Check, Download, Landmark, ArrowRight,
  ChevronDown, ChevronRight, BarChart3, ArrowDownLeft, ArrowUpRight,
  Pencil, WifiOff, Search,
} from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import {
  getCashflowDashboard,
  getUncategorizedTransactions,
  getRecentTransactions,
  categorizeTransactions,
  aiSuggestCategories,
} from "@/actions/cashflow";
import type {
  CashflowDashboard,
  UncategorizedTransaction,
  RecategorizableTransaction,
} from "@/actions/cashflow";
import { formatCurrency } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  NEUTRAL_CATEGORIES,
} from "@/lib/cashflow-categories";
import { downloadCsv, type CsvColumn } from "@/lib/export-csv";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════════════

const PERIODS = [
  { label: "6 mois", value: 6 },
  { label: "12 mois", value: 12 },
  { label: "24 mois", value: 24 },
] as const;

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
  padding: "12px 16px",
};

function fmtK(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Page principale — layout fluide, pas d'onglets
// ═══════════════════════════════════════════════════════════════════════════

export default function CashflowPage() {
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;

  const [period, setPeriod] = useState<number>(12);
  const [chartView, setChartView] = useState<"all" | "operational" | "exceptional" | "financement">("all");
  const [data, setData] = useState<CashflowDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showCategorize, setShowCategorize] = useState(false);
  const [showRecategorize, setShowRecategorize] = useState(false);

  const reload = useCallback(() => {
    if (!societyId) return;
    startTransition(async () => {
      const result = await getCashflowDashboard(societyId, period);
      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error ?? "Erreur inconnue");
        setData(null);
      }
    });
  }, [societyId, period]);

   
  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Cash-flow
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Suivi des flux financiers et ventilation des recettes et dépenses
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => { setShowRecategorize(!showRecategorize); setShowCategorize(false); }}>
                <Pencil className="h-4 w-4" />
                Modifier les affectations
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={() => exportCashflow(data)}>
                <Download className="h-4 w-4" />
                Exporter
              </Button>
            </>
          )}
          <div className="flex bg-muted rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  period === p.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Chargement */}
      {isPending && !data && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-blue)]" />
          <span className="ml-3 text-sm text-muted-foreground">Calcul en cours…</span>
        </div>
      )}

      {!isPending && !data && !error && (
        <Card className="border-0 shadow-brand bg-card rounded-xl">
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Aucune donnée disponible. Vérifiez que des comptes bancaires ou des baux actifs existent.
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* ── KPIs ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-5 shadow-brand">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Landmark className="h-4 w-4 text-blue-400 dark:text-blue-400" />
                </div>
                <p className="text-xs text-muted-foreground">Solde bancaire</p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${
                data.totalBankBalance >= 0 ? "text-foreground" : "text-[var(--color-status-negative)]"
              }`}>
                {formatCurrency(data.totalBankBalance)}
              </p>
              <Link href="/banque" className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5 mt-1">
                Voir les comptes <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>

            <div className="bg-card rounded-xl p-5 shadow-brand">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-status-positive-bg)]">
                  <TrendingUp className="h-4 w-4 text-[var(--color-status-positive)]" />
                </div>
                <p className="text-xs text-muted-foreground">Opérationnel net</p>
              </div>
              {(() => {
                const net = data.totalOperationalIncome - data.totalOperationalExpenses;
                return (
                  <p className={`text-2xl font-bold tabular-nums ${net >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}>
                    {net >= 0 ? "+" : ""}{formatCurrency(net)}
                  </p>
                );
              })()}
              <p className="text-[10px] text-muted-foreground mt-1">récurrent · 12 mois glissants</p>
            </div>

            <div className="bg-card rounded-xl p-5 shadow-brand">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-xs text-muted-foreground">Exceptionnel net</p>
              </div>
              {(() => {
                const net = data.totalExceptionalIncome - data.totalExceptionalExpenses;
                return (
                  <p className={`text-2xl font-bold tabular-nums ${net >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}>
                    {net >= 0 ? "+" : ""}{formatCurrency(net)}
                  </p>
                );
              })()}
              <p className="text-[10px] text-muted-foreground mt-1">travaux, cessions · 12 mois</p>
            </div>

            <div className="bg-card rounded-xl p-5 shadow-brand">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Wallet className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-xs text-muted-foreground">Financement net</p>
              </div>
              {(() => {
                const net = data.totalFinancementIn - data.totalFinancementOut;
                return (
                  <p className={`text-2xl font-bold tabular-nums ${net >= 0 ? "text-foreground" : "text-[var(--color-status-negative)]"}`}>
                    {net >= 0 ? "+" : ""}{formatCurrency(net)}
                  </p>
                );
              })()}
              <p className="text-[10px] text-muted-foreground mt-1">CCA, emprunts souscrits</p>
            </div>
          </div>

          {/* ── Alerte transactions non catégorisées ──────────────────── */}
          {data.uncategorizedCount > 0 && (
            <button
              onClick={() => setShowCategorize(!showCategorize)}
              className="w-full flex items-center gap-3 p-4 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800 rounded-xl text-sm hover:bg-amber-100/80 dark:hover:bg-amber-950/30 transition-colors text-left cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {data.uncategorizedCount} transaction{data.uncategorizedCount > 1 ? "s" : ""} à catégoriser
                </p>
                <p className="text-xs text-amber-700/70 dark:text-amber-300/60 mt-0.5">
                  Catégorisez-les pour affiner la ventilation de vos flux.
                </p>
              </div>
              <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
                {showCategorize ? "Masquer" : "Catégoriser"} <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          )}

          {/* ── Section catégorisation (inline, toggle) ───────────────── */}
          {showCategorize && societyId && (
            <CategorizeSection societyId={societyId} onDone={() => { reload(); setShowCategorize(false); }} />
          )}

          {/* ── Alerte comptes bancaires en retard ────────────────────── */}
          {data.bankAccountSummaries.some((a) => a.daysSinceLastTx === null || a.daysSinceLastTx > 30) && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 shrink-0">
                  <WifiOff className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    Relevés bancaires possiblement incomplets
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                    Certains comptes n'ont pas eu de transaction depuis plus de 30 jours. Vérifiez la connexion ou importez un relevé manuellement.
                  </p>
                  <div className="space-y-1.5">
                    {data.bankAccountSummaries.map((acc) => {
                      const stale = acc.daysSinceLastTx === null || acc.daysSinceLastTx > 30;
                      return (
                        <div key={acc.accountId} className="flex items-center gap-2 text-xs">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${stale ? "bg-amber-500" : "bg-green-500"}`} />
                          <span className="font-medium text-foreground truncate">{acc.accountName}</span>
                          <span className="text-muted-foreground shrink-0">
                            {acc.lastTransactionDate
                              ? `dernière opération : ${new Date(acc.lastTransactionDate).toLocaleDateString("fr-FR")}${acc.daysSinceLastTx !== null ? ` (${acc.daysSinceLastTx}j)` : ""}`
                              : "aucune transaction enregistrée"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Link href="/banque" className="shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    Gérer les comptes <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* ── Section re-catégorisation (inline, toggle) ────────────── */}
          {showRecategorize && societyId && (
            <ReCategorizeSection societyId={societyId} onDone={() => { reload(); setShowRecategorize(false); }} />
          )}

          {/* ── Graphique évolution mensuelle ──────────────────────────── */}
          <Card className="border-0 shadow-brand bg-card rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  Évolution mensuelle
                </CardTitle>
                <div className="flex bg-muted rounded-lg p-0.5">
                  {(["all", "operational", "exceptional", "financement"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setChartView(v)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                        chartView === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v === "all" ? "Tout" : v === "operational" ? "Opérationnel" : v === "exceptional" ? "Exceptionnel" : "Financement"}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const incKey = chartView === "operational" ? "operationalIncome" : chartView === "exceptional" ? "exceptionalIncome" : "actualIncome";
                const expKey = chartView === "operational" ? "operationalExpenses" : chartView === "exceptional" ? "exceptionalExpenses" : "actualExpenses";
                const netKey = chartView === "operational" ? "operationalNet" : chartView === "exceptional" ? "exceptionalNet" : "actualNet";
                return (
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={data.months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22C55E" />
                          <stop offset="100%" stopColor="#86EFAC" />
                        </linearGradient>
                        <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#A04040" />
                          <stop offset="100%" stopColor="#FCA5A5" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={64} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v, name) => {
                          const lmap: Record<string, string> = {
                            actualIncome: "Encaissements réels", operationalIncome: "Encaissements récurrents", exceptionalIncome: "Encaissements exceptionnels",
                            actualExpenses: "Décaissements réels", operationalExpenses: "Décaissements récurrents", exceptionalExpenses: "Décaissements exceptionnels",
                            actualNet: "Cash-flow net", operationalNet: "Net opérationnel", exceptionalNet: "Net exceptionnel",
                            projectedNet: "Cash-flow net projeté",
                            financementNet: "Financement net (CCA)",
                          };
                          return [formatCurrency(Number(v)), lmap[String(name)] ?? String(name)];
                        }}
                        cursor={{ fill: "var(--accent)", opacity: 0.5 }}
                      />
                      <Legend formatter={(value: string) => {
                        const lmap: Record<string, string> = {
                          actualIncome: "Encaissements", operationalIncome: "Encaissements", exceptionalIncome: "Encaissements",
                          actualExpenses: "Décaissements", operationalExpenses: "Décaissements", exceptionalExpenses: "Décaissements",
                          actualNet: "Cash-flow net", operationalNet: "Net opérationnel", exceptionalNet: "Net exceptionnel",
                          projectedNet: "Projection nette",
                          financementNet: "Financement net",
                        };
                        return lmap[value] ?? value;
                      }} />
                      <Bar dataKey={incKey} fill="url(#incGrad)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                      <Bar dataKey={expKey} fill="url(#expGrad)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                      <Line type="monotone" dataKey={netKey} stroke="#1B4F8A" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="projectedNet" stroke="#1B4F8A" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                      {chartView === "all" && (
                        <Line type="monotone" dataKey="financementNet" stroke="#7C3AED" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2, fill: "#7C3AED" }} connectNulls />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          {/* ── Ventilation côte à côte : Dépenses | Revenus ──────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownCard
              title="Ventilation des dépenses"
              subtitle="12 mois glissants"
              data={data.globalExpenseBreakdown}
              total={data.totalActualExpenses}
              emptyMessage="Aucune dépense enregistrée"
              monthCount={data.months.filter((m) => m.isPast).length || 1}
              type="expense"
            />
            <BreakdownCard
              title="Ventilation des revenus"
              subtitle="12 mois glissants"
              data={data.globalIncomeBreakdown}
              total={data.totalActualIncome}
              emptyMessage="Aucun revenu enregistré"
              monthCount={data.months.filter((m) => m.isPast).length || 1}
              type="income"
            />
          </div>

          {/* ── Détail mensuel (accordion) ─────────────────────────────── */}
          <MonthlyDetail data={data} />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Carte ventilation (dépenses OU revenus)
// ═══════════════════════════════════════════════════════════════════════════

function BreakdownCard({ title, subtitle, data, total, emptyMessage, monthCount, type }: {
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

// ═══════════════════════════════════════════════════════════════════════════
// Détail mensuel (accordion)
// ═══════════════════════════════════════════════════════════════════════════

function MonthlyDetail({ data }: { data: CashflowDashboard }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const pastMonths = data.months.filter((m) => m.isPast && (m.actualExpenses > 0 || m.actualIncome > 0));

  if (pastMonths.length === 0) return null;

  return (
    <Card className="border-0 shadow-brand bg-card rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Détail mensuel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-3">
        {pastMonths.map((month) => {
          const isExpanded = expanded === month.month;
          const net = month.actualIncome - month.actualExpenses;
          return (
            <div key={month.month} className="border border-border/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : month.month)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left cursor-pointer"
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                }
                <span className="flex-1 text-sm font-semibold text-foreground">{month.label}</span>
                <span className="text-xs font-mono text-[var(--color-status-positive)] tabular-nums">
                  +{formatCurrency(month.actualIncome)}
                </span>
                <span className="text-xs font-mono text-[var(--color-status-negative)] tabular-nums">
                  -{formatCurrency(month.actualExpenses)}
                </span>
                <span className={`text-xs font-mono font-semibold tabular-nums ml-2 px-2 py-0.5 rounded-full ${
                  net >= 0
                    ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]"
                    : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"
                }`}>
                  {net >= 0 ? "+" : ""}{formatCurrency(net)}
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 grid gap-4 lg:grid-cols-2">
                  {/* Dépenses du mois */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ArrowUpRight className="h-3 w-3 text-[var(--color-status-negative)]" />
                      Dépenses
                    </p>
                    {month.expenseBreakdown.length > 0 ? (
                      <div className="space-y-1.5">
                        {month.expenseBreakdown.map((b) => (
                          <div key={b.categoryId} className="flex items-center gap-2 text-sm">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                            <span className="flex-1 text-muted-foreground text-xs">{b.label}</span>
                            <span className="font-mono text-xs tabular-nums">{formatCurrency(b.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucune dépense</p>
                    )}
                  </div>
                  {/* Revenus du mois */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ArrowDownLeft className="h-3 w-3 text-[var(--color-status-positive)]" />
                      Revenus
                    </p>
                    {month.incomeBreakdown.length > 0 ? (
                      <div className="space-y-1.5">
                        {month.incomeBreakdown.map((b) => (
                          <div key={b.categoryId} className="flex items-center gap-2 text-sm">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                            <span className="flex-1 text-muted-foreground text-xs">{b.label}</span>
                            <span className="font-mono text-xs tabular-nums">{formatCurrency(b.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucun revenu</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Section catégorisation (intégrée dans la page, pas un onglet)
// ═══════════════════════════════════════════════════════════════════════════

function CategorizeSection({ societyId, onDone }: { societyId: string; onDone: () => void }) {
  const [transactions, setTransactions] = useState<UncategorizedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getUncategorizedTransactions(societyId);
    if (result.success && result.data) {
      setTransactions(result.data);
      setSelections(new Map());
    }
    setLoading(false);
  }, [societyId]);

   
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleAiSuggest() {
    if (transactions.length === 0) return;
    setAiLoading(true);
    const ids = transactions.slice(0, 50).map((t) => t.id);
    const result = await aiSuggestCategories(societyId, ids);
    if (result.success && result.data) {
      const newSelections = new Map(selections);
      for (const suggestion of result.data) {
        if (suggestion.confidence >= 0.5) {
          newSelections.set(suggestion.transactionId, suggestion.suggestedCategory);
        }
      }
      setSelections(newSelections);
      setTransactions((prev) =>
        prev.map((tx) => {
          const suggestion = result.data!.find((s) => s.transactionId === tx.id);
          return suggestion ? { ...tx, suggestedCategory: suggestion.suggestedCategory } : tx;
        })
      );
      toast.success(`${result.data.length} suggestion${result.data.length > 1 ? "s" : ""} générée${result.data.length > 1 ? "s" : ""}`);
    } else {
      toast.error(result.error ?? "Erreur IA");
    }
    setAiLoading(false);
  }

  async function handleSave() {
    if (selections.size === 0) return;
    setSaving(true);
    const items = Array.from(selections.entries()).map(([transactionId, category]) => ({
      transactionId,
      category,
    }));
    const result = await categorizeTransactions(societyId, items);
    if (result.success) {
      toast.success(`${result.data?.updated} transaction${(result.data?.updated ?? 0) > 1 ? "s" : ""} catégorisée${(result.data?.updated ?? 0) > 1 ? "s" : ""}`);
      onDone();
    } else {
      toast.error(result.error ?? "Erreur");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-brand bg-card rounded-xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement…</span>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="border-0 shadow-brand bg-card rounded-xl">
        <CardContent className="py-12 text-center">
          <Check className="h-10 w-10 text-[var(--color-status-positive)] mx-auto mb-3" />
          <p className="font-semibold text-foreground">Toutes les transactions sont catégorisées</p>
          <p className="text-xs text-muted-foreground mt-1">La ventilation de vos flux est à jour.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-brand bg-card rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Catégorisation des transactions
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAiSuggest} disabled={aiLoading} className="gap-1.5 rounded-lg">
              <Sparkles className={`h-3.5 w-3.5 ${aiLoading ? "animate-pulse" : ""}`} />
              {aiLoading ? "Analyse…" : "Suggestion IA"}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || selections.size === 0} className="gap-1.5 rounded-lg bg-brand-gradient-soft hover:opacity-90 text-white">
              <Check className="h-3.5 w-3.5" />
              Enregistrer ({selections.size})
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {transactions.length} transaction{transactions.length > 1 ? "s" : ""} à catégoriser — l'IA vérifie d'abord les libellés déjà connus.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {transactions.map((tx) => {
            const isDebit = tx.amount < 0;
            const selected = selections.get(tx.id);
            const categories = isDebit ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                {/* Icône direction */}
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isDebit ? "bg-[var(--color-status-negative-bg)]" : "bg-[var(--color-status-positive-bg)]"
                }`}>
                  {isDebit
                    ? <ArrowUpRight className="h-3 w-3 text-[var(--color-status-negative)]" />
                    : <ArrowDownLeft className="h-3 w-3 text-[var(--color-status-positive)]" />
                  }
                </div>

                {/* Libellé */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{tx.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(tx.transactionDate).toLocaleDateString("fr-FR")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      · {tx.bankAccountName}
                    </span>
                  </div>
                </div>

                {/* Montant */}
                <p className={`text-sm font-semibold font-mono tabular-nums shrink-0 ${
                  isDebit ? "text-[var(--color-status-negative)]" : "text-[var(--color-status-positive)]"
                }`}>
                  {isDebit ? "" : "+"}{tx.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </p>

                {/* Sélecteur catégorie */}
                <div className="w-52 shrink-0">
                  <Select
                    value={selected ?? ""}
                    onValueChange={(val) => setSelections((prev) => { const n = new Map(prev); n.set(tx.id, val); return n; })}
                  >
                    <SelectTrigger className={`h-8 text-xs rounded-lg ${
                      selected ? "border-[var(--color-brand-blue)]/40 bg-[var(--color-brand-light)]/30" : tx.suggestedCategory ? "border-amber-300" : ""
                    }`}>
                      <SelectValue placeholder="Catégorie…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-[10px]">Courant</SelectLabel>
                        {categories.filter((cat) => (cat as { recurring?: boolean }).recurring !== false).map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {categories.some((cat) => (cat as { recurring?: boolean }).recurring === false) && (
                        <SelectGroup>
                          <SelectLabel className="text-[10px]">Exceptionnel</SelectLabel>
                          {categories.filter((cat) => (cat as { recurring?: boolean }).recurring === false).map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="text-[10px]">Neutre / Financement</SelectLabel>
                        {NEUTRAL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Section re-catégorisation (modification des affectations existantes)
// ═══════════════════════════════════════════════════════════════════════════

function ReCategorizeSection({ societyId, onDone }: { societyId: string; onDone: () => void }) {
  const [transactions, setTransactions] = useState<RecategorizableTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [txPeriod, setTxPeriod] = useState(12);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getRecentTransactions(societyId, txPeriod);
    if (result.success && result.data) {
      setTransactions(result.data);
      setSelections(new Map());
    }
    setLoading(false);
  }, [societyId, txPeriod]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = search.length >= 2
    ? transactions.filter((tx) => tx.label.toLowerCase().includes(search.toLowerCase()))
    : transactions;

  async function handleSave() {
    if (selections.size === 0) return;
    setSaving(true);
    const items = Array.from(selections.entries()).map(([transactionId, category]) => ({ transactionId, category }));
    const result = await categorizeTransactions(societyId, items);
    if (result.success) {
      toast.success(`${result.data?.updated} affectation${(result.data?.updated ?? 0) > 1 ? "s" : ""} modifiée${(result.data?.updated ?? 0) > 1 ? "s" : ""}`);
      onDone();
    } else {
      toast.error(result.error ?? "Erreur");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-brand bg-card rounded-xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-brand bg-card rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Modifier les affectations
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-muted rounded-lg p-0.5">
              {([1, 3, 6] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTxPeriod(m)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    txPeriod === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m} mois
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer…"
                className="h-8 pl-8 text-xs w-36 rounded-lg"
              />
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving || selections.size === 0} className="gap-1.5 rounded-lg bg-brand-gradient-soft hover:opacity-90 text-white">
              <Check className="h-3.5 w-3.5" />
              Enregistrer ({selections.size})
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} transaction{filtered.length > 1 ? "s" : ""} · cliquez sur la catégorie pour la modifier
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune transaction trouvée</p>
        ) : (
          <div className="divide-y divide-border/40 max-h-[500px] overflow-y-auto">
            {filtered.map((tx) => {
              const isDebit = tx.amount < 0;
              const selected = selections.get(tx.id);
              const displayCat = selected ?? tx.category ?? "";
              const isModified = selected !== undefined;
              const allCats = isDebit ? [...EXPENSE_CATEGORIES] : [...INCOME_CATEGORIES];
              const recurringCats = allCats.filter((cat) => (cat as { recurring?: boolean }).recurring !== false);
              const exceptionalCats = allCats.filter((cat) => (cat as { recurring?: boolean }).recurring === false);
              const allCatsFlat = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...NEUTRAL_CATEGORIES];
              const catInfo = allCatsFlat.find((cat) => cat.id === displayCat);

              return (
                <div key={tx.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  isModified ? "bg-blue-500/5 border-l-2 border-l-blue-400" : "hover:bg-accent/20"
                }`}>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                    isDebit ? "bg-[var(--color-status-negative-bg)]" : "bg-[var(--color-status-positive-bg)]"
                  }`}>
                    {isDebit
                      ? <ArrowUpRight className="h-3 w-3 text-[var(--color-status-negative)]" />
                      : <ArrowDownLeft className="h-3 w-3 text-[var(--color-status-positive)]" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{tx.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.transactionDate).toLocaleDateString("fr-FR")} · {tx.bankAccountName}
                    </p>
                  </div>

                  <p className={`text-xs font-semibold font-mono tabular-nums shrink-0 ${
                    isDebit ? "text-[var(--color-status-negative)]" : "text-[var(--color-status-positive)]"
                  }`}>
                    {isDebit ? "" : "+"}{tx.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>

                  <div className="w-52 shrink-0">
                    <Select
                      value={displayCat}
                      onValueChange={(val) => setSelections((prev) => {
                        const n = new Map(prev);
                        if (val === tx.category) { n.delete(tx.id); } else { n.set(tx.id, val); }
                        return n;
                      })}
                    >
                      <SelectTrigger className={`h-8 text-xs rounded-lg ${isModified ? "border-blue-400 bg-blue-500/5" : ""}`}>
                        <div className="flex items-center gap-1.5 truncate min-w-0">
                          {catInfo && <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: catInfo.color }} />}
                          <SelectValue placeholder="Non catégorisé" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel className="text-[10px]">Courant</SelectLabel>
                          {recurringCats.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        {exceptionalCats.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px]">Exceptionnel</SelectLabel>
                            {exceptionalCats.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <div className="flex items-center gap-2">
                                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  {cat.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-[10px]">Neutre / Financement</SelectLabel>
                          {NEUTRAL_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Export CSV
// ═══════════════════════════════════════════════════════════════════════════

interface CashflowExportRow {
  mois: string;
  encaissements: string;
  decaissements: string;
  cashflowNet: string;
  projectionRevenus: string;
  projectionDepenses: string;
  ventilationDepenses: string;
  ventilationRevenus: string;
}

const EXPORT_COLUMNS: CsvColumn<CashflowExportRow>[] = [
  { header: "Mois", accessor: (r) => r.mois },
  { header: "Encaissements réels", accessor: (r) => r.encaissements },
  { header: "Décaissements réels", accessor: (r) => r.decaissements },
  { header: "Cash-flow net", accessor: (r) => r.cashflowNet },
  { header: "Projection revenus", accessor: (r) => r.projectionRevenus },
  { header: "Projection dépenses", accessor: (r) => r.projectionDepenses },
  { header: "Ventilation dépenses", accessor: (r) => r.ventilationDepenses },
  { header: "Ventilation revenus", accessor: (r) => r.ventilationRevenus },
];

function exportCashflow(data: CashflowDashboard) {
  const rows: CashflowExportRow[] = data.months.map((m) => ({
    mois: m.label,
    encaissements: m.isPast ? m.actualIncome.toFixed(2) : "",
    decaissements: m.isPast ? m.actualExpenses.toFixed(2) : "",
    cashflowNet: m.isPast ? m.actualNet.toFixed(2) : "",
    projectionRevenus: m.projectedIncome.toFixed(2),
    projectionDepenses: m.projectedExpenses.toFixed(2),
    ventilationDepenses: m.expenseBreakdown.map((b) => `${b.label}: ${b.amount.toFixed(2)}€`).join(" | "),
    ventilationRevenus: m.incomeBreakdown.map((b) => `${b.label}: ${b.amount.toFixed(2)}€`).join(" | "),
  }));
  const ds = new Date().toISOString().slice(0, 10);
  downloadCsv(rows, EXPORT_COLUMNS, `cashflow-${ds}`);
}
