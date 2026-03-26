"use client";

import { useState, useTransition, useEffect } from "react";
import { useSociety } from "@/providers/society-provider";
import { getGrandLivre, getFiscalYears, getAccounts } from "@/actions/accounting";
import type { GrandLivreRow, FiscalYearRow, AccountRow } from "@/actions/accounting";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Filter, TrendingDown, TrendingUp, Upload } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const JOURNAL_LABELS: Record<string, string> = {
  AN: "A Nouveaux", AC: "Achats", BQUE: "Banque", INV: "Investissements",
  OD: "Op. Diverses", VT: "Ventes/TVA", VENTES: "Ventes", BANQUE: "Banque", OPERATIONS_DIVERSES: "Op. Diverses",
};

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: "secondary", VALIDEE: "default", CLOTUREE: "outline",
};

export default function GrandLivrePage() {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<GrandLivreRow[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  // Filters
  const [fiscalYearId, setFiscalYearId] = useState<string>("all");
  const [accountId, setAccountId] = useState<string>("all");
  const [journalType, setJournalType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!activeSociety?.id) return;
    const id = activeSociety.id;
    getFiscalYears(id).then(r => { if (r.success && r.data) setFiscalYears(r.data); });
    getAccounts(id).then(r => { if (r.success && r.data) setAccounts(r.data); });
  }, [activeSociety?.id]);

  function load() {
    if (!activeSociety?.id) return;
    startTransition(async () => {
      const res = await getGrandLivre(activeSociety.id, {
        accountId: accountId === "all" ? undefined : accountId,
        fiscalYearId: fiscalYearId === "all" ? undefined : fiscalYearId,
        journalType: journalType === "all" ? undefined : journalType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (res.success && res.data) setRows(res.data);
      else toast.error(res.error ?? "Erreur");
    });
  }

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  // Group by account
  const byAccount = rows.reduce<Record<string, GrandLivreRow[]>>((acc, r) => {
    const key = r.accountCode;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Grand Livre</h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/comptabilite/grand-livre/importer">
            <Upload className="h-4 w-4" />
            Importer
          </Link>
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Filter className="h-4 w-4" />Filtres</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <select value={fiscalYearId} onChange={e => setFiscalYearId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="all">Tous les exercices</option>
              {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.year}</option>)}
            </select>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="all">Tous les comptes</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
            </select>
            <select value={journalType} onChange={e => setJournalType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="all">Tous les journaux</option>
              {Object.entries(JOURNAL_LABELS).slice(0, 6).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Du" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Au" />
          </div>
          <Button onClick={load} disabled={isPending} className="mt-3">{isPending ? "Chargement..." : "Afficher"}</Button>
        </CardContent>
      </Card>

      {/* Totaux */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-xs text-muted-foreground">Total Débit</div>
                <div className="text-xl font-bold text-green-700">{formatCurrency(totalDebit)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-red-600" />
              <div>
                <div className="text-xs text-muted-foreground">Total Crédit</div>
                <div className="text-xl font-bold text-red-700">{formatCurrency(totalCredit)}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table par compte */}
      {Object.entries(byAccount).map(([code, lines]) => {
        const accLabel = lines[0]?.accountLabel ?? "";
        const lastSolde = lines[lines.length - 1]?.solde ?? 0;
        return (
          <Card key={code}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="font-mono font-bold">{code}</span>
                <span className="font-normal text-muted-foreground">{accLabel}</span>
                <span className={lastSolde >= 0 ? "text-green-700" : "text-red-700"}>
                  Solde : {formatCurrency(lastSolde)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Date</TableHead>
                      <TableHead className="w-20">Pièce</TableHead>
                      <TableHead className="w-16">Journal</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="text-right w-28">Débit</TableHead>
                      <TableHead className="text-right w-28">Crédit</TableHead>
                      <TableHead className="text-right w-28">Solde</TableHead>
                      <TableHead className="w-16">Let.</TableHead>
                      <TableHead className="w-20">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{formatDate(l.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{l.piece ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{JOURNAL_LABELS[l.journalType] ?? l.journalType}</Badge></TableCell>
                        <TableCell className="text-sm">{l.label}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-700">{l.debit > 0 ? formatCurrency(l.debit) : ""}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-700">{l.credit > 0 ? formatCurrency(l.credit) : ""}</TableCell>
                        <TableCell className={"text-right font-mono text-sm font-semibold " + (l.solde >= 0 ? "text-green-800" : "text-red-800")}>{formatCurrency(l.solde)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{l.lettrage ?? ""}</TableCell>
                        <TableCell><Badge variant={STATUS_COLORS[l.status] as never} className="text-xs">{l.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {rows.length === 0 && !isPending && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sélectionnez des filtres et cliquez sur Afficher
          </CardContent>
        </Card>
      )}
    </div>
  );
}
