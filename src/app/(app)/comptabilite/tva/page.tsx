"use client";

import { useEffect, useState, useTransition } from "react";
import { Calculator, CheckCircle2, Filter, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { getVatControl, type VatControlResult } from "@/actions/vat-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSociety } from "@/providers/society-provider";
import { formatCurrency } from "@/lib/utils";

function currentYearRange() {
  const year = new Date().getFullYear();
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
}

function discrepancyVariant(value: number): "default" | "destructive" | "outline" {
  if (Math.abs(value) <= 0.01) return "default";
  return "destructive";
}

export default function VatControlPage() {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(currentYearRange);
  const [data, setData] = useState<VatControlResult | null>(null);

  function load() {
    if (!activeSociety?.id) return;
    startTransition(async () => {
      const result = await getVatControl(activeSociety.id, {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast.error(result.error ?? "Erreur lors du contrôle TVA");
      }
    });
  }

  useEffect(() => {
    load();
    // Les filtres ne doivent pas déclencher un rechargement avant action utilisateur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSociety?.id]);

  const netDiscrepancy = data?.discrepancies.netDue ?? 0;
  const isBalanced = Math.abs(netDiscrepancy) <= 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Contrôle TVA</h1>
            <p className="text-sm text-muted-foreground">
              Rapprochement entre écritures 445, factures clients et factures fournisseurs
            </p>
          </div>
        </div>
        {data && (
          <Badge variant={isBalanced ? "default" : "destructive"} className="gap-1">
            {isBalanced ? <CheckCircle2 className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
            {isBalanced ? "TVA cohérente" : "Écart détecté"}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4" />
            Période contrôlée
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="date-from">Du</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">Au</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={load} disabled={isPending}>
                <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Contrôler
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">TVA collectée</p>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(data.accounting.collected)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Factures clients : {formatCurrency(data.business.customerVat)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">TVA déductible</p>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(data.accounting.deductible)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Factures fournisseurs : {formatCurrency(data.business.supplierVat)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">TVA nette à payer</p>
                <p className="mt-2 text-2xl font-bold">{formatCurrency(data.accounting.netDue)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Attendue : {formatCurrency(data.business.netDue)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Écarts de contrôle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">Collectée</span>
                  <Badge variant={discrepancyVariant(data.discrepancies.collected)}>
                    {formatCurrency(data.discrepancies.collected)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">Déductible</span>
                  <Badge variant={discrepancyVariant(data.discrepancies.deductible)}>
                    {formatCurrency(data.discrepancies.deductible)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">Net à payer</span>
                  <Badge variant={discrepancyVariant(data.discrepancies.netDue)}>
                    {formatCurrency(data.discrepancies.netDue)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comptes TVA</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Compte</TableHead>
                      <TableHead>Intitulé</TableHead>
                      <TableHead className="text-right">Débit</TableHead>
                      <TableHead className="text-right">Crédit</TableHead>
                      <TableHead className="text-right">Solde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.accounting.accounts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          Aucun mouvement TVA sur la période
                        </TableCell>
                      </TableRow>
                    )}
                    {data.accounting.accounts.map((account) => (
                      <TableRow key={account.accountId}>
                        <TableCell className="font-mono text-sm font-medium">{account.code}</TableCell>
                        <TableCell>{account.label}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(account.debit)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(account.credit)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(account.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
