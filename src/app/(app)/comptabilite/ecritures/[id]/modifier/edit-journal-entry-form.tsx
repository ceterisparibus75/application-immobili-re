"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Plus, Save, Scale, Trash2 } from "lucide-react";

import { getAccounts, getFiscalYears, updateJournalEntry, type AccountRow, type FiscalYearRow } from "@/actions/accounting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateJournalEntryTotals, getBalancingPatch } from "@/lib/accounting-entry-utils";
import { formatCurrency } from "@/lib/utils";
import { useSociety } from "@/providers/society-provider";
import { DeleteJournalEntryButton } from "../../../_components/delete-journal-entry-button";
import { ACCOUNTING_JOURNAL_LABELS, CANONICAL_ACCOUNTING_JOURNAL_TYPES } from "@/lib/accounting-journals";

const JOURNALS = CANONICAL_ACCOUNTING_JOURNAL_TYPES.map((value) => ({
  value,
  label: value + " - " + ACCOUNTING_JOURNAL_LABELS[value],
}));

type Line = { id: string; accountId: string; label: string; debit: string; credit: string };

type InitialEntry = {
  id: string;
  journalType: string;
  entryDate: string;
  piece: string;
  label: string;
  fiscalYearId: string;
  lines: Line[];
};

function newLine(): Line {
  return { id: Math.random().toString(36).slice(2), accountId: "", label: "", debit: "", credit: "" };
}

export function EditJournalEntryForm({ initialEntry }: { initialEntry: InitialEntry }) {
  const { activeSociety } = useSociety();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRow[]>([]);
  const [journal, setJournal] = useState(initialEntry.journalType);
  const [date, setDate] = useState(initialEntry.entryDate);
  const [piece, setPiece] = useState(initialEntry.piece);
  const [label, setLabel] = useState(initialEntry.label);
  const [fiscalYearId, setFiscalYearId] = useState(initialEntry.fiscalYearId || "none");
  const [lines, setLines] = useState<Line[]>(initialEntry.lines.length > 0 ? initialEntry.lines : [newLine(), newLine()]);

  useEffect(() => {
    if (!activeSociety?.id) return;
    getAccounts(activeSociety.id).then((result) => { if (result.success && result.data) setAccounts(result.data); });
    getFiscalYears(activeSociety.id).then((result) => { if (result.success && result.data) setFiscalYears(result.data); });
  }, [activeSociety?.id]);

  const totals = calculateJournalEntryTotals(lines);
  const { totalDebit, totalCredit, isBalanced } = totals;
  const diff = totals.difference;

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  const accountsByClass = accounts.reduce<Record<string, AccountRow[]>>((acc, account) => {
    if (!acc[account.type]) acc[account.type] = [];
    acc[account.type].push(account);
    return acc;
  }, {});

  function setLine(id: string, field: keyof Line, value: string) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  }

  function removeLine(id: string) {
    if (lines.length <= 2) return;
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function handleBalance() {
    const patch = getBalancingPatch(lines);
    if (!patch) return;

    setLines((current) => {
      const target =
        [...current].reverse().find((line) => line.accountId && !line.debit && !line.credit) ??
        [...current].reverse().find((line) => line.accountId) ??
        current[current.length - 1];
      if (!target) return [...current, { ...newLine(), ...patch }];
      return current.map((line) => line.id === target.id ? { ...line, ...patch } : line);
    });
  }

  function handleSubmit() {
    if (!activeSociety?.id) return;
    if (!label.trim()) {
      toast.error("Le libellé est obligatoire");
      return;
    }
    if (!isBalanced) {
      toast.error("L'écriture doit être équilibrée");
      return;
    }

    const validLines = lines.filter((line) => line.accountId && (Number.parseFloat(line.debit) > 0 || Number.parseFloat(line.credit) > 0));
    if (validLines.length < 2) {
      toast.error("Au minimum 2 lignes avec compte et montant");
      return;
    }

    startTransition(async () => {
      const result = await updateJournalEntry(activeSociety.id, initialEntry.id, {
        journalType: journal,
        entryDate: date,
        piece: piece || undefined,
        label,
        fiscalYearId: fiscalYearId === "none" ? undefined : fiscalYearId,
        lines: validLines.map((line) => ({
          accountId: line.accountId,
          label: line.label || undefined,
          debit: Number.parseFloat(line.debit) || 0,
          credit: Number.parseFloat(line.credit) || 0,
        })),
      });

      if (result.success) {
        toast.success("Écriture mise à jour");
        router.push("/comptabilite");
        return;
      }
      toast.error(result.error ?? "Erreur lors de la modification");
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Modifier l'écriture</h1>
        <p className="text-sm text-muted-foreground">Seules les écritures en brouillon peuvent être modifiées.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">En-tête de l'écriture</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label>Journal *</Label>
            <select value={journal} onChange={(event) => setJournal(event.target.value)} className={selectClass}>
              {JOURNALS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div>
            <Label>N° de pièce</Label>
            <Input value={piece} onChange={(event) => setPiece(event.target.value)} placeholder="FAC-001" />
          </div>
          <div className="col-span-2">
            <Label>Libellé *</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <div>
            <Label>Exercice</Label>
            <select value={fiscalYearId} onChange={(event) => setFiscalYearId(event.target.value)} className={selectClass}>
              <option value="none">Sans exercice</option>
              {fiscalYears.map((year) => (
                <option key={year.id} value={year.id} disabled={year.isClosed}>
                  {year.year}{year.isClosed ? " (clôturé)" : ""}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lignes d'écriture</CardTitle>
          <div className="flex items-center gap-2">
            <div className={"flex items-center gap-2 text-sm font-medium " + (isBalanced ? "text-[var(--color-status-positive)]" : diff > 0 ? "text-[var(--color-status-negative)]" : "text-muted-foreground")}>
              {totalDebit > 0 && (isBalanced
                ? <><CheckCircle2 className="h-4 w-4" />Écriture équilibrée</>
                : <><AlertTriangle className="h-4 w-4" />Écart : {formatCurrency(diff)}</>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleBalance} disabled={isBalanced || diff <= 0.01}>
              <Scale className="h-4 w-4" />
              Équilibrer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Compte</TableHead>
                  <TableHead>Libellé ligne</TableHead>
                  <TableHead className="w-32">Débit (€)</TableHead>
                  <TableHead className="w-32">Crédit (€)</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <select value={line.accountId} onChange={(event) => setLine(line.id, "accountId", event.target.value)} className={selectClass + " font-mono"}>
                        <option value="">Sélectionner un compte</option>
                        {Object.entries(accountsByClass).sort((a, b) => a[0].localeCompare(b[0])).map(([classe, classAccounts]) => (
                          <optgroup key={classe} label={"Classe " + classe}>
                            {classAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell><Input value={line.label} onChange={(event) => setLine(line.id, "label", event.target.value)} /></TableCell>
                    <TableCell>
                      <Input type="number" min="0" step="0.01" value={line.debit} onChange={(event) => setLine(line.id, "debit", event.target.value)} onFocus={() => line.credit && setLine(line.id, "credit", "")} className="text-right font-mono text-sm" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="0" step="0.01" value={line.credit} onChange={(event) => setLine(line.id, "credit", event.target.value)} onFocus={() => line.debit && setLine(line.id, "debit", "")} className="text-right font-mono text-sm" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} disabled={lines.length <= 2} className="h-8 w-8">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Totaux</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCredit)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div className="p-4 border-t">
            <Button variant="outline" size="sm" onClick={() => setLines((current) => [...current, newLine()])}>
              <Plus className="h-4 w-4" />Ajouter une ligne
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Button onClick={handleSubmit} disabled={isPending || !isBalanced || !label.trim()} size="lg">
            <Save className="h-4 w-4" />
            {isPending ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.push("/comptabilite")}>Annuler</Button>
        </div>
        {activeSociety?.id && (
          <DeleteJournalEntryButton
            societyId={activeSociety.id}
            entryId={initialEntry.id}
            redirectTo="/comptabilite"
            size="lg"
          />
        )}
      </div>
    </div>
  );
}
