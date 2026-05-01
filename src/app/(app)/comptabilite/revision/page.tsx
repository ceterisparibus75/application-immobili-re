"use client";

import { useEffect, useState, useTransition } from "react";
import { ClipboardCheck, Loader2, Save, SearchCheck } from "lucide-react";
import { toast } from "sonner";

import {
  getAccountReviewBoard,
  updateAccountReview,
  type AccountReviewBoard,
  type AccountReviewRow,
} from "@/actions/account-review";
import { getFiscalYears, type FiscalYearRow } from "@/actions/accounting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useSociety } from "@/providers/society-provider";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "TODO", label: "À revoir" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "REVIEWED", label: "Revu" },
  { value: "ISSUE", label: "Point ouvert" },
] as const;

const STATUS_BADGES: Record<AccountReviewRow["status"], "default" | "secondary" | "outline" | "destructive"> = {
  TODO: "secondary",
  IN_PROGRESS: "outline",
  REVIEWED: "default",
  ISSUE: "destructive",
};

function selectClassName() {
  return "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";
}

function parseStatus(value: string): AccountReviewRow["status"] | null {
  const option = STATUS_OPTIONS.find((item) => item.value === value);
  return option?.value ?? null;
}

export default function AccountRevisionPage() {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRow[]>([]);
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [board, setBoard] = useState<AccountReviewBoard | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeSociety?.id) return;
    getFiscalYears(activeSociety.id).then((result) => {
      if (!result.success || !result.data) return;
      setFiscalYears(result.data);
      const current = result.data.find((year) => !year.isClosed) ?? result.data[0];
      if (current) setFiscalYearId(current.id);
    });
  }, [activeSociety?.id]);

  function load(nextFiscalYearId = fiscalYearId) {
    if (!activeSociety?.id || !nextFiscalYearId) return;
    startTransition(async () => {
      const result = await getAccountReviewBoard(activeSociety.id, nextFiscalYearId);
      if (result.success && result.data) {
        setBoard(result.data);
        setNotes(Object.fromEntries(result.data.rows.map((row) => [row.accountId, row.note ?? ""])));
      } else {
        toast.error(result.error ?? "Erreur lors du chargement de la révision");
      }
    });
  }

  useEffect(() => {
    load(fiscalYearId);
    // Chargement uniquement quand l'exercice sélectionné change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalYearId]);

  function updateRow(accountId: string, patch: Partial<Pick<AccountReviewRow, "status" | "note">>) {
    if (!activeSociety?.id || !fiscalYearId || !board) return;
    const row = board.rows.find((item) => item.accountId === accountId);
    if (!row) return;

    const nextStatus = patch.status ?? row.status;
    const nextNote = patch.note ?? notes[accountId] ?? "";

    startTransition(async () => {
      const result = await updateAccountReview(activeSociety.id, {
        fiscalYearId,
        accountId,
        status: nextStatus,
        note: nextNote,
      });
      if (result.success) {
        toast.success("Révision mise à jour");
        load(fiscalYearId);
      } else {
        toast.error(result.error ?? "Erreur lors de la mise à jour");
      }
    });
  }

  const selectedFiscalYear = fiscalYears.find((year) => year.id === fiscalYearId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Révision comptable</h1>
            <p className="text-sm text-muted-foreground">
              Suivi de revue des comptes par exercice
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
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
            Actualiser
          </Button>
        </div>
      </div>

      {selectedFiscalYear && (
        <Card className="border-muted bg-muted/20">
          <CardContent className="py-3 text-sm text-muted-foreground">
            Exercice {selectedFiscalYear.year} : {formatDate(selectedFiscalYear.startDate)} au{" "}
            {formatDate(selectedFiscalYear.endDate)}
          </CardContent>
        </Card>
      )}

      {board && (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Comptes</p><p className="text-2xl font-bold">{board.stats.total}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">À revoir</p><p className="text-2xl font-bold">{board.stats.todo}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">En cours</p><p className="text-2xl font-bold">{board.stats.inProgress}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Points ouverts</p><p className="text-2xl font-bold">{board.stats.issue}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Avancement</p><p className="text-2xl font-bold">{board.stats.completionRate} %</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comptes à réviser</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Compte</TableHead>
                      <TableHead>Intitulé</TableHead>
                      <TableHead className="text-right">Solde</TableHead>
                      <TableHead className="w-36">Statut</TableHead>
                      <TableHead className="min-w-72">Note</TableHead>
                      <TableHead className="w-28 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {board.rows.map((row) => (
                      <TableRow key={row.accountId}>
                        <TableCell className="font-mono text-sm font-medium">{row.code}</TableCell>
                        <TableCell>
                          <div className="font-medium">{row.label}</div>
                          <div className="text-xs text-muted-foreground">
                            Débit {formatCurrency(row.totalDebit)} · Crédit {formatCurrency(row.totalCredit)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(row.balance)}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge variant={STATUS_BADGES[row.status]}>
                              {STATUS_OPTIONS.find((option) => option.value === row.status)?.label ?? row.status}
                            </Badge>
                            <select
                              value={row.status}
                              onChange={(event) => {
                                const status = parseStatus(event.target.value);
                                if (status) updateRow(row.accountId, { status });
                              }}
                              className={selectClassName()}
                              disabled={isPending}
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={notes[row.accountId] ?? ""}
                            onChange={(event) => setNotes((current) => ({ ...current, [row.accountId]: event.target.value }))}
                            className="min-h-20 text-sm"
                            placeholder="Observation, pièce manquante, justification..."
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateRow(row.accountId, { note: notes[row.accountId] ?? "" })}
                            disabled={isPending}
                          >
                            <Save className="h-4 w-4" />
                            Note
                          </Button>
                        </TableCell>
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
