"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  ArrowLeft, TrendingUp, TrendingDown, Wallet, Loader2,
  AlertTriangle, Sparkles, Check, Download, Landmark, ArrowRight,
  ChevronDown, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import {
  getCashflowDashboard,
  getUncategorizedTransactions,
  categorizeTransactions,
  aiSuggestCategories,
} from "@/actions/cashflow";
import type {
  CashflowDashboard,
  UncategorizedTransaction,
} from "@/actions/cashflow";
import { formatCurrency } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
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

const TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "ventilation", label: "Ventilation des dépenses" },
  { id: "categorize", label: "Catégorisation" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #E2E8F0",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#0C2340",
  boxShadow: "0 4px 16px rgba(12, 35, 64, 0.08)",
};

function fmtK(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Page principale
// ═══════════════════════════════════════════════════════════════════════════

export default function CashflowPage() {
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;

  const [period, setPeriod] = useState<number>(12);
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<CashflowDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/comptabilite"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Cash-flow</h1>
            <p className="text-sm text-muted-foreground">
              Suivi des flux financiers, ventilation des dépenses et projections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCashflow(data)}>
              <Download className="h-4 w-4" />
              Exporter CSV
            </Button>
          )}
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

      {/* Erreur */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Chargement */}
      {isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Calcul en cours...</span>
        </div>
      )}

      {!isPending && data && (
        <>
          {/* Alerte transactions non catégorisées */}
          {data.uncategorizedCount > 0 && (
            <button
              onClick={() => setTab("categorize")}
              className="w-full flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors text-left cursor-pointer"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="flex-1">
                <strong>{data.uncategorizedCount} transaction{data.uncategorizedCount > 1 ? "s" : ""} non catégorisée{data.uncategorizedCount > 1 ? "s" : ""}</strong>
                {" "}— Catégorisez-les pour affiner la ventilation de vos dépenses.
              </span>
              <span className="text-xs font-medium flex items-center gap-1">
                Catégoriser <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          )}

          {/* Lien rapide vers Banque */}
          <div className="flex items-center gap-3">
            <Link href="/banque" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary text-xs font-medium transition-colors">
              <Landmark className="h-3.5 w-3.5" />
              Voir les comptes bancaires
              <ArrowRight className="h-3 w-3" />
            </Link>
            <span className="text-xs text-muted-foreground">
              Solde bancaire total : <strong className={data.totalBankBalance >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}>
                {formatCurrency(data.totalBankBalance)}
              </strong>
            </span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {t.id === "categorize" && data.uncategorizedCount > 0 && (
                  <span className="ml-1.5 inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {data.uncategorizedCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Contenu onglet */}
          {tab === "overview" && <OverviewTab data={data} />}
          {tab === "ventilation" && <VentilationTab data={data} />}
          {tab === "categorize" && societyId && (
            <CategorizeTab societyId={societyId} onDone={() => {
              if (!societyId) return;
              startTransition(async () => {
                const result = await getCashflowDashboard(societyId, period);
                if (result.success && result.data) { setData(result.data); }
              });
            }} />
          )}
        </>
      )}

      {!isPending && !data && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune donnée disponible. Vérifiez que des comptes bancaires ou des baux actifs existent.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet : Vue d'ensemble
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({ data }: { data: CashflowDashboard }) {
  const totalNetActual = data.totalActualIncome - data.totalActualExpenses;
  const totalNetProjected = data.totalProjectedIncome - data.totalProjectedExpenses;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          icon={<Landmark className="h-6 w-6 text-blue-600" />}
          label="Solde bancaire"
          value={formatCurrency(data.totalBankBalance)}
          valueClass={data.totalBankBalance >= 0 ? "text-blue-700" : "text-[var(--color-status-negative)]"}
        />
        <KpiCard
          icon={<TrendingUp className="h-6 w-6 text-[var(--color-status-positive)]" />}
          label="Encaissements (12 mois)"
          value={formatCurrency(data.totalActualIncome)}
          valueClass="text-[var(--color-status-positive)]"
        />
        <KpiCard
          icon={<TrendingDown className="h-6 w-6 text-[var(--color-status-negative)]" />}
          label="Décaissements (12 mois)"
          value={formatCurrency(data.totalActualExpenses)}
          valueClass="text-[var(--color-status-negative)]"
        />
        <KpiCard
          icon={<Wallet className="h-6 w-6 text-indigo-600" />}
          label="Cash-flow réel"
          value={formatCurrency(totalNetActual)}
          valueClass={totalNetActual >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}
        />
        <KpiCard
          icon={<Sparkles className="h-6 w-6 text-amber-500" />}
          label="Projection nette"
          value={formatCurrency(totalNetProjected)}
          valueClass={totalNetProjected >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}
        />
      </div>

      {/* Graphique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution mensuelle</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={data.months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} width={64} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, name) => {
                  const labels: Record<string, string> = {
                    actualIncome: "Encaissements réels",
                    actualExpenses: "Décaissements réels",
                    projectedIncome: "Revenus projetés",
                    projectedExpenses: "Dépenses projetées",
                    actualNet: "Cash-flow net réel",
                    projectedNet: "Cash-flow net projeté",
                  };
                  return [formatCurrency(Number(v)), labels[String(name)] ?? String(name)];
                }}
                cursor={{ fill: "#F0F9FF", opacity: 0.6 }}
              />
              <Legend formatter={(value: string) => {
                const labels: Record<string, string> = {
                  actualIncome: "Encaissements",
                  actualExpenses: "Décaissements",
                  projectedNet: "Projection nette",
                  actualNet: "Cash-flow net",
                };
                return labels[value] ?? value;
              }} />
              <Bar dataKey="actualIncome" fill="url(#incGrad)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="actualExpenses" fill="url(#expGrad)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Line type="monotone" dataKey="actualNet" stroke="#1B4F8A" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="projectedNet" stroke="#1B4F8A" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tableau mensuel */}
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
                  <TableHead className="text-right">Encaissements</TableHead>
                  <TableHead className="text-right">Décaissements</TableHead>
                  <TableHead className="text-right">Cash-flow net</TableHead>
                  <TableHead className="text-right">Projection revenus</TableHead>
                  <TableHead className="text-right">Projection dépenses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.months.map((row) => (
                  <TableRow key={row.month} className={row.isPast ? "bg-muted/30" : undefined}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.isPast ? formatCurrency(row.actualIncome) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.isPast ? formatCurrency(row.actualExpenses) : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${
                      row.isPast
                        ? row.actualNet >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"
                        : "text-muted-foreground"
                    }`}>
                      {row.isPast ? formatCurrency(row.actualNet) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {formatCurrency(row.projectedIncome)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {formatCurrency(row.projectedExpenses)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet : Ventilation des dépenses
// ═══════════════════════════════════════════════════════════════════════════

function VentilationTab({ data }: { data: CashflowDashboard }) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Répartition globale */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie chart dépenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des dépenses (12 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.globalExpenseBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune dépense enregistrée</p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={data.globalExpenseBreakdown}
                      dataKey="amount"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={2}
                    >
                      {data.globalExpenseBreakdown.map((entry) => (
                        <Cell key={entry.categoryId} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v, name) => [formatCurrency(Number(v)), String(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {data.globalExpenseBreakdown.map((b) => (
                    <div key={b.categoryId} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="flex-1 truncate">{b.label}</span>
                      <span className="font-mono text-xs tabular-nums">{formatCurrency(b.amount)}</span>
                      <span className="text-xs text-muted-foreground w-10 text-right">{b.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie chart revenus */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition des revenus (12 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.globalIncomeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun revenu enregistré</p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={data.globalIncomeBreakdown}
                      dataKey="amount"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={2}
                    >
                      {data.globalIncomeBreakdown.map((entry) => (
                        <Cell key={entry.categoryId} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v, name) => [formatCurrency(Number(v)), String(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {data.globalIncomeBreakdown.map((b) => (
                    <div key={b.categoryId} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="flex-1 truncate">{b.label}</span>
                      <span className="font-mono text-xs tabular-nums">{formatCurrency(b.amount)}</span>
                      <span className="text-xs text-muted-foreground w-10 text-right">{b.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Détail par catégorie de dépense */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des dépenses par catégorie</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Montant total</TableHead>
                  <TableHead className="text-right">% du total</TableHead>
                  <TableHead className="text-right">Moyenne / mois</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.globalExpenseBreakdown.map((b) => {
                  const pastMonthsCount = data.months.filter((m) => m.isPast).length || 1;
                  return (
                    <TableRow key={b.categoryId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                          <span className="font-medium">{b.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(b.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {b.percentage}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {formatCurrency(b.amount / pastMonthsCount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data.globalExpenseBreakdown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Aucune dépense catégorisée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Ventilation mois par mois (expandable) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventilation mensuelle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-3">
          {data.months.filter((m) => m.isPast && m.actualExpenses > 0).map((month) => {
            const isExpanded = expandedMonth === month.month;
            return (
              <div key={month.month} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedMonth(isExpanded ? null : month.month)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left cursor-pointer"
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                  <span className="flex-1 text-sm font-medium">{month.label}</span>
                  <span className="text-sm font-mono text-[var(--color-status-negative)]">
                    -{formatCurrency(month.actualExpenses)}
                  </span>
                  <span className="text-sm font-mono text-[var(--color-status-positive)]">
                    +{formatCurrency(month.actualIncome)}
                  </span>
                </button>
                {isExpanded && month.expenseBreakdown.length > 0 && (
                  <div className="px-4 pb-3 space-y-1.5">
                    {month.expenseBreakdown.map((b) => (
                      <div key={b.categoryId} className="flex items-center gap-2 text-sm pl-7">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                        <span className="flex-1 text-muted-foreground">{b.label}</span>
                        <span className="font-mono text-xs">{formatCurrency(b.amount)}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{b.percentage}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet : Catégorisation (avec IA)
// ═══════════════════════════════════════════════════════════════════════════

function CategorizeTab({ societyId, onDone }: { societyId: string; onDone: () => void }) {
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
      // Mettre à jour les transactions avec les suggestions
      setTransactions((prev) =>
        prev.map((tx) => {
          const suggestion = result.data!.find((s) => s.transactionId === tx.id);
          return suggestion ? { ...tx, suggestedCategory: suggestion.suggestedCategory } : tx;
        })
      );
      toast.success(`${result.data.length} suggestion${result.data.length > 1 ? "s" : ""} générée${result.data.length > 1 ? "s" : ""} par l'IA`);
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
      load();
    } else {
      toast.error(result.error ?? "Erreur");
    }
    setSaving(false);
  }

  function setCategory(txId: string, category: string) {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(txId, category);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Chargement des transactions...</span>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Check className="h-12 w-12 text-[var(--color-status-positive)] mx-auto mb-3" />
          <p className="text-lg font-medium">Toutes les transactions sont catégorisées</p>
          <p className="text-sm text-muted-foreground mt-1">
            La ventilation de vos dépenses est à jour.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {transactions.length} transaction{transactions.length > 1 ? "s" : ""} à catégoriser
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAiSuggest} disabled={aiLoading} className="gap-1.5">
            <Sparkles className={`h-4 w-4 ${aiLoading ? "animate-pulse" : ""}`} />
            {aiLoading ? "Analyse IA..." : "Suggestion IA"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || selections.size === 0} className="gap-1.5">
            <Check className="h-4 w-4" />
            Enregistrer ({selections.size})
          </Button>
        </div>
      </div>

      {/* Liste des transactions */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {transactions.map((tx) => {
              const selected = selections.get(tx.id);
              return (
                <div key={tx.id} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.transactionDate).toLocaleDateString("fr-FR")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {tx.bankAccountName}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold font-mono text-[var(--color-status-negative)] shrink-0">
                    {tx.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                  <div className="w-56 shrink-0">
                    <Select
                      value={selected ?? ""}
                      onValueChange={(val) => setCategory(tx.id, val)}
                    >
                      <SelectTrigger className={`h-8 text-xs ${selected ? "border-primary/50" : tx.suggestedCategory ? "border-amber-300" : ""}`}>
                        <SelectValue placeholder="Catégorie..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Composants utilitaires
// ═══════════════════════════════════════════════════════════════════════════

function KpiCard({ icon, label, value, valueClass }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className={`text-xl font-bold truncate ${valueClass ?? ""}`}>{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
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
  ventilation: string;
}

const EXPORT_COLUMNS: CsvColumn<CashflowExportRow>[] = [
  { header: "Mois", accessor: (r) => r.mois },
  { header: "Encaissements réels", accessor: (r) => r.encaissements },
  { header: "Décaissements réels", accessor: (r) => r.decaissements },
  { header: "Cash-flow net", accessor: (r) => r.cashflowNet },
  { header: "Projection revenus", accessor: (r) => r.projectionRevenus },
  { header: "Projection dépenses", accessor: (r) => r.projectionDepenses },
  { header: "Détail ventilation dépenses", accessor: (r) => r.ventilation },
];

function exportCashflow(data: CashflowDashboard) {
  const rows: CashflowExportRow[] = data.months.map((m) => ({
    mois: m.label,
    encaissements: m.isPast ? m.actualIncome.toFixed(2) : "",
    decaissements: m.isPast ? m.actualExpenses.toFixed(2) : "",
    cashflowNet: m.isPast ? m.actualNet.toFixed(2) : "",
    projectionRevenus: m.projectedIncome.toFixed(2),
    projectionDepenses: m.projectedExpenses.toFixed(2),
    ventilation: m.expenseBreakdown
      .map((b) => `${b.label}: ${b.amount.toFixed(2)}€`)
      .join(" | "),
  }));
  const ds = new Date().toISOString().slice(0, 10);
  downloadCsv(rows, EXPORT_COLUMNS, `cashflow-${ds}`);
}
