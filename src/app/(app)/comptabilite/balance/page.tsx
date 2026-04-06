"use client";

import { useState, useTransition, useEffect } from "react";
import { useSociety } from "@/providers/society-provider";
import { getBalance, getFiscalYears } from "@/actions/accounting";
import type { BalanceRow, FiscalYearRow } from "@/actions/accounting";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Scale, AlertTriangle, CheckCircle2, Filter } from "lucide-react";
import { toast } from "sonner";

const CLASSES = [
  { value: "1", label: "Classe 1 — Capitaux" },
  { value: "2", label: "Classe 2 — Immobilisations" },
  { value: "3", label: "Classe 3 — Stocks" },
  { value: "4", label: "Classe 4 — Tiers" },
  { value: "5", label: "Classe 5 — Financiers" },
  { value: "6", label: "Classe 6 — Charges" },
  { value: "7", label: "Classe 7 — Produits" },
];

export default function BalancePage() {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRow[]>([]);
  const [fiscalYearId, setFiscalYearId] = useState<string>("all");
  const [classe, setClasse] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!activeSociety?.id) return;
    getFiscalYears(activeSociety.id).then(r => { if (r.success && r.data) setFiscalYears(r.data); });
  }, [activeSociety?.id]);

  function load() {
    if (!activeSociety?.id) return;
    startTransition(async () => {
      const res = await getBalance(activeSociety.id, {
        fiscalYearId: fiscalYearId === "all" ? undefined : fiscalYearId,
        classe: classe === "all" ? undefined : classe,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (res.success && res.data) setRows(res.data);
      else toast.error(res.error ?? "Erreur");
    });
  }

  const totalDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);
  const totalDebiteur = rows.reduce((s, r) => s + r.soldeDebiteur, 0);
  const totalCrediteur = rows.reduce((s, r) => s + r.soldeCrediteur, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Group by class
  const byClasse = rows.reduce<Record<string, BalanceRow[]>>((acc, r) => {
    if (!acc[r.classe]) acc[r.classe] = [];
    acc[r.classe].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Balance des comptes</h1>
        </div>
        {rows.length > 0 && (
          <div className={"flex items-center gap-2 text-sm font-medium " + (isBalanced ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]")}>
            {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {isBalanced ? "Balance équilibrée" : "Balance déséquilibrée"}
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Filter className="h-4 w-4" />Filtres</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={fiscalYearId} onChange={e => setFiscalYearId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="all">Tous les exercices</option>
              {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.year}</option>)}
            </select>
            <select value={classe} onChange={e => setClasse(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="all">Toutes les classes</option>
              {CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <Button onClick={load} disabled={isPending} className="mt-3">{isPending ? "Chargement..." : "Calculer"}</Button>
        </CardContent>
      </Card>

      {Object.entries(byClasse).sort((a, b) => a[0].localeCompare(b[0])).map(([cl, clRows]) => {
        const clDebit = clRows.reduce((s, r) => s + r.totalDebit, 0);
        const clCredit = clRows.reduce((s, r) => s + r.totalCredit, 0);
        const classLabel = CLASSES.find(c => c.value === cl)?.label ?? ("Classe " + cl);
        return (
          <Card key={cl}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">{classLabel}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">N° Compte</TableHead>
                      <TableHead>Intitulé</TableHead>
                      <TableHead className="text-right w-32">Total Débit</TableHead>
                      <TableHead className="text-right w-32">Total Crédit</TableHead>
                      <TableHead className="text-right w-32">Solde Débiteur</TableHead>
                      <TableHead className="text-right w-32">Solde Créditeur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clRows.map(r => (
                      <TableRow key={r.accountId}>
                        <TableCell className="font-mono text-sm font-semibold">{r.code}</TableCell>
                        <TableCell className="text-sm">{r.label}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(r.totalDebit)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(r.totalCredit)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-[var(--color-status-positive)]">{r.soldeDebiteur > 0 ? formatCurrency(r.soldeDebiteur) : ""}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-[var(--color-status-negative)]">{r.soldeCrediteur > 0 ? formatCurrency(r.soldeCrediteur) : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell colSpan={2}>Sous-total {classLabel}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(clDebit)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(clCredit)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {rows.length > 0 && (
        <Card className={isBalanced ? "border-[var(--color-status-positive)]" : "border-[var(--color-status-negative)]"}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableFooter>
                  <TableRow className="bg-muted font-bold text-base">
                    <TableCell colSpan={2}>TOTAUX GÉNÉRAUX</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(totalCredit)}</TableCell>
                    <TableCell className="text-right font-mono text-[var(--color-status-positive)]">{formatCurrency(totalDebiteur)}</TableCell>
                    <TableCell className="text-right font-mono text-[var(--color-status-negative)]">{formatCurrency(totalCrediteur)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && !isPending && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sélectionnez des filtres et cliquez sur Calculer
          </CardContent>
        </Card>
      )}
    </div>
  );
}
