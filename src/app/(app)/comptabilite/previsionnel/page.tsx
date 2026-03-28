"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Plus, Save, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { getBudgetLines, upsertBudgetLine } from "@/actions/loan";

type Account = { id: string; code: string; label: string; type: string };
type BudgetLine = {
  id: string;
  year: number;
  month: number | null;
  accountId: string;
  budgetAmount: number;
  label: string | null;
  account: Account;
};
type JournalEntry = {
  lines: { accountId: string; debit: number; credit: number }[];
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function classLabel(type: string): string {
  const cls = type.charAt(0);
  const labels: Record<string, string> = {
    "1": "Classe 1 — Capitaux propres",
    "2": "Classe 2 — Immobilisations",
    "3": "Classe 3 — Stocks",
    "4": "Classe 4 — Tiers",
    "5": "Classe 5 — Financier",
    "6": "Classe 6 — Charges",
    "7": "Classe 7 — Produits",
  };
  return labels[cls] ?? `Classe ${cls}`;
}

export default function PrevisionnelPage() {
  const { activeSociety } = useSociety();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [actuals, setActuals] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Édition locale
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editLabel, setEditLabel] = useState("");

  // Ajout
  const [showAdd, setShowAdd] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (!activeSociety) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    Promise.all([
      fetch("/api/comptabilite/accounts").then((r) => r.json()),
      activeSociety
        ? fetch(`/api/comptabilite/entries?year=${year}`).then((r) => r.json()).catch(() => [])
        : Promise.resolve([]),
    ]).then(([accs, entries]) => {
      setAccounts(Array.isArray(accs) ? accs : []);
      setActuals(Array.isArray(entries) ? entries : []);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [activeSociety, year]);

  useEffect(() => {
    if (!activeSociety) return;
    getBudgetLines(activeSociety.id, year).then((lines) => {
      setBudgetLines(lines as BudgetLine[]);
    });
  }, [activeSociety, year]);

  // Calcul réalisé par compte depuis les écritures
  function getActual(accountId: string): number {
    let debit = 0, credit = 0;
    for (const entry of actuals) {
      for (const line of entry.lines) {
        if (line.accountId === accountId) {
          debit += line.debit;
          credit += line.credit;
        }
      }
    }
    // Convention: classe 6 = charges (débit), classe 7 = produits (crédit)
    return debit - credit;
  }

  async function saveBudgetLine(budgetLine: BudgetLine) {
    if (!activeSociety) return;
    startTransition(async () => {
      await upsertBudgetLine(activeSociety.id, {
        year: budgetLine.year,
        month: budgetLine.month,
        accountId: budgetLine.accountId,
        budgetAmount: budgetLine.budgetAmount,
        label: budgetLine.label,
      });
    });
  }

  async function handleEdit(line: BudgetLine) {
    if (!activeSociety) return;
    startTransition(async () => {
      const updated = { ...line, budgetAmount: parseFloat(editAmount) || 0, label: editLabel || null };
      await upsertBudgetLine(activeSociety.id, updated);
      setBudgetLines((prev) => prev.map((l) => l.id === line.id ? { ...l, budgetAmount: updated.budgetAmount, label: updated.label } : l));
      setEditingId(null);
    });
  }

  async function handleAdd() {
    if (!activeSociety || !newAccountId || !newAmount) return;
    const acc = accounts.find((a) => a.id === newAccountId);
    if (!acc) return;
    startTransition(async () => {
      const result = await upsertBudgetLine(activeSociety.id, {
        year,
        month: null,
        accountId: newAccountId,
        budgetAmount: parseFloat(newAmount),
        label: newLabel || null,
      });
      if ("data" in result && result.data) {
        setBudgetLines((prev) => {
          const existing = prev.find((l) => l.accountId === newAccountId && l.month === null);
          if (existing) {
            return prev.map((l) => l.id === existing.id ? { ...l, budgetAmount: parseFloat(newAmount), label: newLabel || null } : l);
          }
          return [...prev, { id: result.data!.id, year, month: null, accountId: newAccountId, budgetAmount: parseFloat(newAmount), label: newLabel || null, account: acc }];
        });
      }
      setNewAccountId("");
      setNewAmount("");
      setNewLabel("");
      setShowAdd(false);
    });
  }

  // Grouper les lignes budgétaires par classe comptable
  const grouped = budgetLines.reduce<Record<string, BudgetLine[]>>((acc, line) => {
    const cls = classLabel(line.account.type);
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(line);
    return acc;
  }, {});

  const totalBudget = budgetLines.reduce((s, l) => s + l.budgetAmount, 0);
  const totalActual = budgetLines.reduce((s, l) => s + getActual(l.accountId), 0);
  const variance = totalActual - totalBudget;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Link href="/comptabilite">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Prévisionnel</h1>
          <p className="text-muted-foreground">Budget vs. réalisé par compte comptable</p>
        </div>
        {/* Sélecteur d'exercice */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Exercice</span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary/70" />
              <div>
                <p className="text-2xl font-bold">{fmt(totalBudget)}</p>
                <p className="text-xs text-muted-foreground">Budget {year}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{fmt(totalActual)}</p>
                <p className="text-xs text-muted-foreground">Réalisé</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Minus className={`h-8 w-8 ${variance >= 0 ? "text-green-600 dark:text-green-400/70 dark:text-green-400/70" : "text-destructive/70"}`} />
              <div>
                <p className={`text-2xl font-bold ${variance >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {variance >= 0 ? "+" : ""}{fmt(variance)}
                </p>
                <p className="text-xs text-muted-foreground">Écart réalisé − prévu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau budget vs réalisé */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Budget par compte — exercice {year}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Formulaire d'ajout */}
          {showAdd && (
            <div className="mb-6 p-4 border rounded-md bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Nouvelle ligne budgétaire</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <select
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Compte comptable…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Input
                    type="number" step="0.01" placeholder="Montant budgété (€)"
                    value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Commentaire (optionnel)"
                    value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={isPending || !newAccountId || !newAmount}>
                  <Save className="h-4 w-4" />
                  Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
          ) : budgetLines.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground mb-2">Aucun budget défini pour {year}</p>
              <p className="text-xs text-muted-foreground">
                Utilisez &quot;Ajouter une ligne&quot; pour définir vos prévisions par compte comptable.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cls, lines]) => {
                const clsBudget = lines.reduce((s, l) => s + l.budgetAmount, 0);
                const clsActual = lines.reduce((s, l) => s + getActual(l.accountId), 0);
                return (
                  <div key={cls}>
                    <div className="flex items-center justify-between mb-2 pb-1 border-b">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cls}</p>
                      <div className="flex gap-6 text-xs text-muted-foreground">
                        <span>Prévu: <strong className="text-foreground">{fmt(clsBudget)}</strong></span>
                        <span>Réalisé: <strong className="text-foreground">{fmt(clsActual)}</strong></span>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left pb-1 pr-2 font-medium">Compte</th>
                          <th className="text-left pb-1 pr-2 font-medium">Libellé</th>
                          <th className="text-right pb-1 pr-2 font-medium">Prévu</th>
                          <th className="text-right pb-1 pr-2 font-medium">Réalisé</th>
                          <th className="text-right pb-1 pr-2 font-medium">Écart</th>
                          <th className="text-right pb-1 font-medium">%</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lines.map((line) => {
                          const actual = getActual(line.accountId);
                          const ecart = actual - line.budgetAmount;
                          const pct = line.budgetAmount !== 0 ? (actual / line.budgetAmount) * 100 : null;
                          const isEditing = editingId === line.id;
                          return (
                            <tr key={line.id} className="hover:bg-accent/30">
                              <td className="py-2 pr-2 font-mono text-xs">{line.account.code}</td>
                              <td className="py-2 pr-2 text-muted-foreground text-xs">
                                {line.account.label}
                                {line.label && <span className="ml-1 text-foreground">· {line.label}</span>}
                              </td>
                              {isEditing ? (
                                <>
                                  <td className="py-2 pr-2" colSpan={4}>
                                    <div className="flex gap-2 items-center justify-end">
                                      <Input
                                        type="number" step="0.01" className="h-7 w-28 text-xs"
                                        value={editAmount}
                                        onChange={(e) => setEditAmount(e.target.value)}
                                      />
                                      <Input
                                        className="h-7 w-32 text-xs"
                                        placeholder="Commentaire"
                                        value={editLabel}
                                        onChange={(e) => setEditLabel(e.target.value)}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2 pl-1">
                                    <div className="flex gap-1 justify-end">
                                      <Button size="icon" className="h-6 w-6" variant="ghost"
                                        onClick={() => handleEdit(line)} disabled={isPending}>
                                        <Save className="h-3 w-3" />
                                      </Button>
                                      <Button size="icon" className="h-6 w-6" variant="ghost"
                                        onClick={() => setEditingId(null)}>
                                        ✕
                                      </Button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-2 pr-2 text-right tabular-nums">{fmt(line.budgetAmount)}</td>
                                  <td className="py-2 pr-2 text-right tabular-nums">{fmt(actual)}</td>
                                  <td className={`py-2 pr-2 text-right tabular-nums font-medium ${ecart >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                                    {ecart >= 0 ? "+" : ""}{fmt(ecart)}
                                  </td>
                                  <td className="py-2 pr-2 text-right tabular-nums text-xs text-muted-foreground">
                                    {pct !== null ? `${Math.round(pct)}%` : "—"}
                                  </td>
                                  <td className="py-2 pl-1">
                                    <Button size="icon" className="h-6 w-6" variant="ghost"
                                      onClick={() => { setEditingId(line.id); setEditAmount(line.budgetAmount.toString()); setEditLabel(line.label ?? ""); }}>
                                      ✎
                                    </Button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
