"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, FileSpreadsheet, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { getAnnualStatements, type AnnualStatementLine, type AnnualStatements } from "@/actions/annual-statements";
import { getFiscalYears, type FiscalYearRow } from "@/actions/accounting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSociety } from "@/providers/society-provider";
import { formatCurrency, formatDate } from "@/lib/utils";
import { annualStatementsCsvFilename, annualStatementsToCsv } from "@/lib/annual-statements-export";

function selectClassName() {
  return "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";
}

function StatementTable({
  title,
  lines,
  total,
}: {
  title: string;
  lines: AnnualStatementLine[];
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Compte</TableHead>
              <TableHead>Intitulé</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  Aucun mouvement
                </TableCell>
              </TableRow>
            )}
            {lines.map((line) => (
              <TableRow key={`${line.accountId}-${line.code}`}>
                <TableCell className="font-mono text-sm font-medium">{line.code}</TableCell>
                <TableCell>{line.label}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(line.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-semibold">
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function AnnualStatementsPage() {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRow[]>([]);
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [data, setData] = useState<AnnualStatements | null>(null);

  useEffect(() => {
    if (!activeSociety?.id) return;
    getFiscalYears(activeSociety.id).then((result) => {
      if (!result.success || !result.data) return;
      setFiscalYears(result.data);
      const selected = result.data.find((year) => !year.isClosed) ?? result.data[0];
      if (selected) setFiscalYearId(selected.id);
    });
  }, [activeSociety?.id]);

  function load(nextFiscalYearId = fiscalYearId) {
    if (!activeSociety?.id || !nextFiscalYearId) return;
    startTransition(async () => {
      const result = await getAnnualStatements(activeSociety.id, nextFiscalYearId);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast.error(result.error ?? "Erreur lors du calcul des états annuels");
      }
    });
  }

  function handleExportCsv() {
    if (!data) return;
    const blob = new Blob([annualStatementsToCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = annualStatementsCsvFilename(data);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    load(fiscalYearId);
    // Chargement uniquement quand l'exercice change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalYearId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">États annuels</h1>
            <p className="text-sm text-muted-foreground">
              Bilan simplifié et compte de résultat par exercice
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={fiscalYearId}
            onChange={(event) => setFiscalYearId(event.target.value)}
            className={selectClassName() + " w-40"}
          >
            {fiscalYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => load()} disabled={isPending || !fiscalYearId}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualiser
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={!data}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {data && (
        <>
          <Card className="border-muted bg-muted/20">
            <CardContent className="py-3 text-sm text-muted-foreground">
              Exercice {data.fiscalYear.year} : {formatDate(data.fiscalYear.startDate)} au {formatDate(data.fiscalYear.endDate)}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Produits</p><p className="text-2xl font-bold">{formatCurrency(data.incomeStatement.totalProducts)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Charges</p><p className="text-2xl font-bold">{formatCurrency(data.incomeStatement.totalCharges)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Résultat</p><p className="text-2xl font-bold">{formatCurrency(data.incomeStatement.result)}</p></CardContent></Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Bilan</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-2xl font-bold">{formatCurrency(data.balanceSheet.totalAssets)}</p>
                  <Badge variant={data.balanceSheet.balanced ? "default" : "destructive"} className="gap-1">
                    {!data.balanceSheet.balanced && <TriangleAlert className="h-3 w-3" />}
                    {data.balanceSheet.balanced ? "Équilibré" : "Écart"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StatementTable title="Actif" lines={data.balanceSheet.assets} total={data.balanceSheet.totalAssets} />
            <StatementTable title="Passif" lines={data.balanceSheet.liabilities} total={data.balanceSheet.totalLiabilities} />
            <StatementTable title="Charges" lines={data.incomeStatement.charges} total={data.incomeStatement.totalCharges} />
            <StatementTable title="Produits" lines={data.incomeStatement.products} total={data.incomeStatement.totalProducts} />
          </div>
        </>
      )}
    </div>
  );
}
