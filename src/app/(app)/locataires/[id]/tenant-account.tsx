"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import { useState, useTransition } from "react";
import { createTenantBalanceAdjustment } from "@/actions/tenant";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  reference: string | null;
}

interface AccountInvoice {
  id: string;
  invoiceNumber: string | null;
  invoiceType: string;
  status: string;
  issueDate: string;
  dueDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  payments: Payment[];
}

interface BalanceAdjustment {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  notes: string | null;
}

interface TenantAccountProps {
  tenantId: string;
  societyId: string;
  invoices: AccountInvoice[];
  adjustments: BalanceAdjustment[];
  balance: number;
  tenantName: string;
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  APPEL_LOYER: "Appel de loyer",
  QUITTANCE: "Quittance",
  REGULARISATION_CHARGES: "Régularisation",
  REFACTURATION: "Refacturation",
  AVOIR: "Avoir",
};

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  BROUILLON: "Brouillon",
  VALIDEE: "Validée",
  ENVOYEE: "Envoyée",
  RELANCEE: "Relancée",
  PAYE: "Payée",
  PARTIELLEMENT_PAYE: "Partiel",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
  IRRECOUVRABLE: "Irrecouvrable",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  EN_ATTENTE: "secondary",
  BROUILLON: "secondary",
  VALIDEE: "default",
  ENVOYEE: "default",
  RELANCEE: "warning",
  PAYE: "success",
  PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive",
  ANNULEE: "secondary",
  IRRECOUVRABLE: "destructive",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const mois = s.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  if (!e || s.getMonth() === e.getMonth()) return mois;
  return `${s.toLocaleDateString("fr-FR", { month: "short" })} - ${e.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`;
}

/**
 * Construit les mouvements chronologiques pour le relevé locatif.
 * Chaque facture = débit (ou crédit si avoir), chaque paiement = crédit.
 */
function buildMovements(invoices: AccountInvoice[], adjustments: BalanceAdjustment[]) {
  const movements: Array<{
    date: string;
    label: string;
    type: "debit" | "credit";
    amount: number;
    invoiceId?: string;
    invoiceNumber?: string;
    status?: string;
  }> = [];

  for (const adjustment of adjustments) {
    movements.push({
      date: adjustment.dueDate,
      label: adjustment.notes ? `${adjustment.label} — ${adjustment.notes}` : adjustment.label,
      type: adjustment.amount >= 0 ? "debit" : "credit",
      amount: Math.abs(adjustment.amount),
    });
  }

  for (const inv of invoices) {
    if (inv.status === "ANNULEE" || inv.status === "BROUILLON") continue;
    if (inv.invoiceType === "QUITTANCE") continue;

    const typeLabel = INVOICE_TYPE_LABELS[inv.invoiceType] ?? inv.invoiceType;
    const period = formatPeriod(inv.periodStart, inv.periodEnd);
    const label = period ? `${typeLabel} — ${period}` : typeLabel;

    if (inv.invoiceType === "AVOIR") {
      movements.push({
        date: inv.issueDate,
        label,
        type: "credit",
        amount: inv.totalTTC,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber ?? undefined,
        status: inv.status,
      });
    } else {
      movements.push({
        date: inv.issueDate,
        label,
        type: "debit",
        amount: inv.totalTTC,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber ?? undefined,
        status: inv.status,
      });
    }

    // Paiements
    for (const p of inv.payments) {
      movements.push({
        date: p.paidAt,
        label: `Paiement ${inv.invoiceNumber}${p.method ? ` (${p.method})` : ""}${p.reference ? ` — Réf: ${p.reference}` : ""}`,
        type: "credit",
        amount: p.amount,
      });
    }
  }

  // Trier par date croissante
  movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculer le solde courant
  let runningBalance = 0;
  return movements.map((m) => {
    if (m.type === "debit") {
      runningBalance += m.amount;
    } else {
      runningBalance -= m.amount;
    }
    return { ...m, balance: Math.round(runningBalance * 100) / 100 };
  });
}

export function TenantAccount({
  tenantId,
  societyId,
  invoices,
  adjustments,
  balance,
  tenantName,
}: TenantAccountProps) {
  const movements = buildMovements(invoices, adjustments);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Résumé
  const totalFacture = invoices
    .filter((i) => i.status !== "ANNULEE" && i.status !== "BROUILLON" && i.invoiceType !== "AVOIR" && i.invoiceType !== "QUITTANCE")
    .reduce((s, i) => s + i.totalTTC, 0);
  const totalAvoir = invoices
    .filter((i) => i.status !== "ANNULEE" && i.status !== "BROUILLON" && i.invoiceType === "AVOIR")
    .reduce((s, i) => s + i.totalTTC, 0);
  const totalPaiements = invoices
    .filter((i) => i.status !== "ANNULEE" && i.status !== "BROUILLON" && i.invoiceType !== "QUITTANCE")
    .reduce((s, i) => s + i.payments.reduce((ps, p) => ps + p.amount, 0), 0);

  // Import de solde précédent
  const [showDebitDialog, setShowDebitDialog] = useState(false);
  const [debitForm, setDebitForm] = useState({
    label: "",
    amount: "",
    dueDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  async function handleCreateDebit() {
    if (!debitForm.label || !debitForm.amount) return;
    startTransition(async () => {
      const result = await createTenantBalanceAdjustment(societyId, {
        tenantId,
        label: debitForm.label,
        amount: debitForm.amount,
        dueDate: debitForm.dueDate,
        notes: debitForm.notes || undefined,
      });
      if (result.success) {
        toast.success("Solde précédent importé");
        setShowDebitDialog(false);
        setDebitForm({ label: "", amount: "", dueDate: new Date().toISOString().slice(0, 10), notes: "" });
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  // Export CSV du relevé
  function exportCsv() {
    const header = "Date;Libellé;Débit;Crédit;Solde\n";
    const rows = movements.map((m) =>
      [
        formatDate(m.date),
        `"${m.label}"`,
        m.type === "debit" ? formatCurrency(m.amount) : "",
        m.type === "credit" ? formatCurrency(m.amount) : "",
        formatCurrency(m.balance),
      ].join(";")
    );
    const csv = "\uFEFF" + header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toLocaleDateString("fr-FR").replace(/\//g, "-");
    a.download = `releve-locatif-${tenantName.replace(/\s+/g, "-").toLowerCase()}-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Compte locataire
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Relevé CSV
            </Button>
            <Dialog open={showDebitDialog} onOpenChange={setShowDebitDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Importer un solde précédent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importer un solde précédent</DialogTitle>
                  <DialogDescription>
                    Reprendre un solde existant sans générer de facture ni de numéro.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Libellé</Label>
                    <Input
                      placeholder="Ex: Solde antérieur au démarrage"
                      value={debitForm.label}
                      onChange={(e) => setDebitForm({ ...debitForm, label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Montant TTC du solde (€)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={debitForm.amount}
                      onChange={(e) => setDebitForm({ ...debitForm, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date de reprise</Label>
                    <Input
                      type="date"
                      value={debitForm.dueDate}
                      onChange={(e) => setDebitForm({ ...debitForm, dueDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Notes (optionnel)</Label>
                    <Textarea
                      placeholder="Détail ou contexte..."
                      value={debitForm.notes}
                      onChange={(e) => setDebitForm({ ...debitForm, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDebitDialog(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreateDebit} disabled={isPending || !debitForm.label || !debitForm.amount}>
                    {isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Total facturé</p>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(totalFacture)} €
            </p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Total avoirs</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              -{formatCurrency(totalAvoir)} €
            </p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Total paiements</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              -{formatCurrency(totalPaiements)} €
            </p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${balance > 0 ? "border-destructive/30 bg-destructive/5" : balance < 0 ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
            <p className="text-xs text-muted-foreground">Solde dû</p>
            <p className={`text-lg font-bold tabular-nums ${balance > 0 ? "text-destructive" : balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
              {balance > 0 ? "+" : ""}{formatCurrency(balance)} €
            </p>
          </div>
        </div>

        {/* Tableau des mouvements */}
        {movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun mouvement pour ce locataire</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right w-[100px]">Débit</TableHead>
                  <TableHead className="text-right w-[100px]">Crédit</TableHead>
                  <TableHead className="text-right w-[120px]">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m, i) => (
                  <TableRow key={i} className={m.status === "ANNULEE" ? "opacity-40 line-through" : ""}>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {formatDate(m.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.type === "debit" ? (
                          <ArrowUpCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : (
                          <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        <span className="text-xs">{m.label}</span>
                        {m.invoiceNumber && (
                          <a
                            href={`/facturation/${m.invoiceId}`}
                            className="text-[10px] text-muted-foreground hover:underline shrink-0"
                          >
                            {m.invoiceNumber}
                          </a>
                        )}
                        {m.status && (
                          <Badge variant={STATUS_VARIANTS[m.status] ?? "default"} className="text-[10px] shrink-0">
                            {STATUS_LABELS[m.status] ?? m.status}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-destructive font-medium">
                      {m.type === "debit" ? `${formatCurrency(m.amount)} €` : ""}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      {m.type === "credit" ? `${formatCurrency(m.amount)} €` : ""}
                    </TableCell>
                    <TableCell className={`text-right text-xs tabular-nums font-semibold ${m.balance > 0 ? "text-destructive" : m.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                      {m.balance > 0 ? "+" : ""}{formatCurrency(m.balance)} €
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
