"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { createJournalEntry, getAccounts, getFiscalYears } from "@/actions/accounting";
import type { AccountRow, FiscalYearRow } from "@/actions/accounting";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Plus, Trash2, AlertTriangle, CheckCircle2, PenLine } from "lucide-react";
import { toast } from "sonner";

const JOURNALS = [
  { value: "AN", label: "AN — À Nouveaux" },
  { value: "AC", label: "AC — Achats" },
  { value: "BQUE", label: "BQUE — Banque" },
  { value: "INV", label: "INV — Investissements" },
  { value: "OD", label: "OD — Opérations Diverses" },
  { value: "VT", label: "VT — Ventes/TVA" },
];

type Line = { id: string; accountId: string; label: string; debit: string; credit: string };

function newLine(): Line {
  return { id: Math.random().toString(36).slice(2), accountId: "", label: "", debit: "", credit: "" };
}

export default function NouvelleEcriturePage() {
  const { activeSociety } = useSociety();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRow[]>([]);
  const [journal, setJournal] = useState("OD");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [piece, setPiece] = useState("");
  const [label, setLabel] = useState("");
  const [fiscalYearId, setFiscalYearId] = useState("none");
  const [lines, setLines] = useState<Line[]>([newLine(), newLine()]);

  useEffect(() => {
    if (!activeSociety?.id) return;
    getAccounts(activeSociety.id).then(r => { if (r.success && r.data) setAccounts(r.data); });
    getFiscalYears(activeSociety.id).then(r => {
      if (r.success && r.data) {
        setFiscalYears(r.data);
        const current = r.data.find(fy => !fy.isClosed);
        if (current) setFiscalYearId(current.id);
      }
    });
  }, [activeSociety?.id]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  const diff = Math.abs(totalDebit - totalCredit);

  function setLine(id: string, field: keyof Line, value: string) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  function removeLine(id: string) {
    if (lines.length <= 2) return;
    setLines(ls => ls.filter(l => l.id !== id));
  }

  function handleSubmit() {
    if (!activeSociety?.id) return;
    if (!label.trim()) { toast.error("Le libellé est obligatoire"); return; }
    if (!isBalanced) { toast.error("L’écriture doit être équilibrée"); return; }
    const validLines = lines.filter(l => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) { toast.error("Au minimum 2 lignes avec compte et montant"); return; }

    startTransition(async () => {
      const res = await createJournalEntry(activeSociety.id, {
        journalType: journal,
        entryDate: date,
        piece: piece || undefined,
        label,
        fiscalYearId: fiscalYearId === "none" ? undefined : fiscalYearId,
        lines: validLines.map(l => ({
          accountId: l.accountId,
          label: l.label || undefined,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      });
      if (res.success) {
        toast.success("Écriture créée avec succès");
        router.push("/comptabilite");
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  const accountsByClass = accounts.reduce<Record<string, AccountRow[]>>((acc, a) => {
    if (!acc[a.type]) acc[a.type] = [];
    acc[a.type].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <PenLine className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Nouvelle écriture comptable</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">En-tête de l’écriture</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label>Journal *</Label>
            <select value={journal} onChange={e => setJournal(e.target.value)} className={selectClass}>
              {JOURNALS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label>N° de pièce</Label>
            <Input value={piece} onChange={e => setPiece(e.target.value)} placeholder="FAC-001" />
          </div>
          <div className="col-span-2">
            <Label>Libellé *</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex : Loyer janvier 2026" />
          </div>
          <div>
            <Label>Exercice</Label>
            <select value={fiscalYearId} onChange={e => setFiscalYearId(e.target.value)} className={selectClass}>
              <option value="none">Sans exercice</option>
              {fiscalYears.map(fy => (
                <option key={fy.id} value={fy.id} disabled={fy.isClosed}>
                  {fy.year}{fy.isClosed ? " (clôturé)" : ""}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lignes d’écriture</CardTitle>
          <div className={"flex items-center gap-2 text-sm font-medium " + (isBalanced ? "text-[var(--color-status-positive)]" : diff > 0 ? "text-[var(--color-status-negative)]" : "text-muted-foreground")}>
            {totalDebit > 0 && (isBalanced
              ? <><CheckCircle2 className="h-4 w-4" />Écriture équilibrée</>
              : <><AlertTriangle className="h-4 w-4" />Écart : {formatCurrency(diff)}</>
            )}
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
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <select
                        value={l.accountId}
                        onChange={e => setLine(l.id, "accountId", e.target.value)}
                        className={selectClass + " font-mono"}
                      >
                        <option value="">Sélectionner un compte</option>
                        {Object.entries(accountsByClass).sort((a, b) => a[0].localeCompare(b[0])).map(([cl, accs]) => (
                          <optgroup key={cl} label={"Classe " + cl}>
                            {accs.map(a => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input value={l.label} onChange={e => setLine(l.id, "label", e.target.value)} placeholder="Libellé (optionnel)" className="text-sm" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="0" step="0.01" value={l.debit}
                        onChange={e => setLine(l.id, "debit", e.target.value)}
                        onFocus={() => l.credit && setLine(l.id, "credit", "")}
                        className="text-right font-mono text-sm" placeholder="0,00" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="0" step="0.01" value={l.credit}
                        onChange={e => setLine(l.id, "credit", e.target.value)}
                        onFocus={() => l.debit && setLine(l.id, "debit", "")}
                        className="text-right font-mono text-sm" placeholder="0,00" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeLine(l.id)} disabled={lines.length <= 2} className="h-8 w-8">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Totaux</TableCell>
                  <TableCell className={"text-right font-mono font-bold " + (totalDebit > 0 ? "text-[var(--color-status-positive)]" : "")}>{formatCurrency(totalDebit)}</TableCell>
                  <TableCell className={"text-right font-mono font-bold " + (totalCredit > 0 ? "text-[var(--color-status-negative)]" : "")}>{formatCurrency(totalCredit)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div className="p-4 border-t">
            <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, newLine()])}>
              <Plus className="h-4 w-4 mr-1" />Ajouter une ligne
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={isPending || !isBalanced || !label.trim()} size="lg">
          {isPending ? "Enregistrement..." : "Enregistrer l’écriture"}
        </Button>
        <Button variant="outline" size="lg" onClick={() => router.push("/comptabilite")}>Annuler</Button>
      </div>
    </div>
  );
}
