"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, SelectSeparator,
} from "@/components/ui/select";
import { Loader2, Search, Check, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  getRecentTransactions,
  categorizeTransactions,
} from "@/actions/cashflow";
import type { RecategorizableTransaction } from "@/actions/cashflow";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  NEUTRAL_CATEGORIES,
} from "@/lib/cashflow-categories";

export function ReCategorizeSection({ societyId, onDone }: { societyId: string; onDone: () => void }) {
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
