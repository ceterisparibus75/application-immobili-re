"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Loader2,
  AlertTriangle, Download, Landmark, ArrowRight,
  BarChart3, Pencil, WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { getCashflowDashboard } from "@/actions/cashflow";
import type { CashflowDashboard } from "@/actions/cashflow";
import { formatCurrency } from "@/lib/utils";
import { downloadCsv, type CsvColumn } from "@/lib/export-csv";
import { BreakdownCard } from "./_components/breakdown-card";
import { MonthlyDetail } from "./_components/monthly-detail";
import { CategorizeSection } from "./_components/categorize-section";
import { ReCategorizeSection } from "./_components/recategorize-section";
import { TOOLTIP_STYLE, fmtK } from "./_components/cashflow-utils";
// ═══════════════════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════════════════

const PERIODS = [
  { label: "6 mois", value: 6 },
  { label: "12 mois", value: 12 },
  { label: "24 mois", value: 24 },
] as const;

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
