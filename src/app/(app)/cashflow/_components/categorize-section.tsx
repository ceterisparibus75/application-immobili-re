"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, SelectSeparator,
} from "@/components/ui/select";
import { Loader2, Sparkles, Check, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  getUncategorizedTransactions,
  categorizeTransactions,
  aiSuggestCategories,
} from "@/actions/cashflow";
import type { UncategorizedTransaction } from "@/actions/cashflow";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  NEUTRAL_CATEGORIES,
} from "@/lib/cashflow-categories";

export function CategorizeSection({ societyId, onDone }: { societyId: string; onDone: () => void }) {
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
