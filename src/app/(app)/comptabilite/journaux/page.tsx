"use client";

import { useEffect, useState, useTransition } from "react";
import { BookMarked, CheckCircle2, Filter, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { getFiscalYears, type FiscalYearRow } from "@/actions/accounting";
import { getJournalSummary, type JournalSummaryRow } from "@/actions/accounting-journals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSociety } from "@/providers/society-provider";

function selectClassName() {
  return "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";
}

export default function JournauxPage() {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRow[]>([]);
  const [rows, setRows] = useState<JournalSummaryRow[]>([]);
  const [fiscalYearId, setFiscalYearId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!activeSociety?.id) return;
    getFiscalYears(activeSociety.id).then((result) => {
      if (!result.success || !result.data) return;
      setFiscalYears(result.data);
      const selected = result.data.find((year) => !year.isClosed) ?? result.data[0];
      if (selected) setFiscalYearId(selected.id);
    });
  }, [activeSociety?.id]);

  function load() {
    if (!activeSociety?.id) return;
    startTransition(async () => {
      const result = await getJournalSummary(activeSociety.id, {
        fiscalYearId: fiscalYearId === "all" ? undefined : fiscalYearId,
        dateFrom: fiscalYearId === "all" ? dateFrom || undefined : undefined,
        dateTo: fiscalYearId === "all" ? dateTo || undefined : undefined,
      });
      if (result.success && result.data) {
        setRows(result.data);
      } else {
        toast.error(result.error ?? "Erreur lors du calcul des journaux");
      }
    });
  }

  useEffect(() => {
    load();
    // Chargement uniquement quand la société ou l'exercice change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSociety?.id, fiscalYearId]);

  const totalEntries = rows.reduce((sum, row) => sum + row.entryCount, 0);
  const totalDebit = rows.reduce((sum, row) => sum + row.totalDebit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.totalCredit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) <= 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookMarked className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Journaux</h1>
            <p className="text-sm text-muted-foreground">Synthèse des écritures par journal comptable</p>
          </div>
        </div>
        {rows.length > 0 && (
          <Badge variant={balanced ? "default" : "destructive"} className="gap-1">
            {balanced ? <CheckCircle2 className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
            {balanced ? "Équilibré" : "Écart"}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <select value={fiscalYearId} onChange={(event) => setFiscalYearId(event.target.value)} className={selectClassName()}>
              <option value="all">Période libre</option>
              {fiscalYears.map((year) => (
                <option key={year.id} value={year.id}>
                  Exercice {year.year}
                </option>
              ))}
            </select>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} disabled={fiscalYearId !== "all"} />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} disabled={fiscalYearId !== "all"} />
            <Button onClick={load} disabled={isPending}>
              {isPending ? "Chargement..." : "Afficher"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Écritures</p><p className="text-2xl font-bold">{totalEntries}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total débit</p><p className="text-2xl font-bold">{formatCurrency(totalDebit)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total crédit</p><p className="text-2xl font-bold">{formatCurrency(totalCredit)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Journal</TableHead>
                <TableHead className="text-right">Écritures</TableHead>
                <TableHead className="text-right">Lignes</TableHead>
                <TableHead className="text-right">Brouillons</TableHead>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right">Crédit</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Aucun journal sur la période sélectionnée
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.journalType}>
                  <TableCell>
                    <div className="font-medium">{row.journalLabel}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.journalType}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{row.entryCount}</TableCell>
                  <TableCell className="text-right font-mono">{row.lineCount}</TableCell>
                  <TableCell className="text-right font-mono">{row.draftCount}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(row.totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(row.totalCredit)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.firstEntryDate && row.lastEntryDate
                      ? `${formatDate(row.firstEntryDate)} - ${formatDate(row.lastEntryDate)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.balanced ? "outline" : "destructive"}>
                      {row.balanced ? "OK" : "Écart"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
