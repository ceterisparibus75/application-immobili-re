"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitMerge, Loader2, Zap, Receipt, Banknote } from "lucide-react";
import {
  autoReconcile,
  manualReconcile,
  reconcileWithInvoice,
  reconcileWithLoanLine,
} from "@/actions/bank-reconciliation";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/utils";

type Transaction = { id: string; transactionDate: Date; amount: number; label: string; reference: string | null; };
type Payment = { id: string; amount: number; paidAt: Date; method: string | null; reference: string | null; invoice: { tenant: { companyName: string | null; firstName: string | null; lastName: string | null; } | null; lease: { lot: { building: { name: string } }; tenant: { companyName: string | null; firstName: string | null; lastName: string | null }; } | null; }; };
type PendingInvoice = { id: string; invoiceNumber: string; invoiceType: string; totalTTC: number; dueDate: Date; status: string; tenant: { companyName: string | null; firstName: string | null; lastName: string | null; } | null; _count: { payments: number }; };
type LoanLine = { id: string; period: number; dueDate: Date; principalPayment: number; interestPayment: number; insurancePayment: number; totalPayment: number; remainingBalance: number; isPaid: boolean; paidAt: Date | null; loan: { id: string; label: string; lender: string }; };
type RightSelection = | { kind: "payment"; id: string } | { kind: "invoice"; id: string } | { kind: "loanLine"; id: string };

const INVOICE_TYPE_LABELS: Record<string, string> = { APPEL_LOYER: "Appel de loyer", QUITTANCE: "Quittance", REGULARISATION_CHARGES: "Régul. charges", REFACTURATION: "Refacturation", AVOIR: "Avoir" };

function tenantLabel(t: { companyName: string | null; firstName: string | null; lastName: string | null } | null): string {
  if (!t) return "—";
  return t.companyName ?? (((t.firstName ?? "") + " " + (t.lastName ?? "")).trim() || "—");
}

interface ReconciliationClientProps { societyId: string; bankAccountId: string; transactions: Transaction[]; payments: Payment[]; pendingInvoices: PendingInvoice[]; loanLines: LoanLine[]; reconciled: unknown[]; }

export default function ReconciliationClient({ societyId, bankAccountId, transactions, payments, pendingInvoices, loanLines }: ReconciliationClientProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<RightSelection | null>(null);
  function toggleTx(id: string) { setSelectedTxId((p) => (p === id ? null : id)); }
  function toggleRight(next: RightSelection) { setSelectedRight((p) => p && p.kind === next.kind && p.id === next.id ? null : next); }
  function handleAutoReconcile() {
    startTransition(async () => {
      const result = await autoReconcile(societyId, bankAccountId);
      if (result.success) { const n = result.data?.matched ?? 0; toast.success(n === 0 ? "Aucun rapprochement automatique trouvé" : n + " rapprochement" + (n > 1 ? "s" : "") + " effectué" + (n > 1 ? "s" : "")); }
      else { toast.error(result.error ?? "Erreur rapprochement automatique"); }
    });
  }
  function handleReconcile() {
    if (!selectedTxId || !selectedRight) return;
    startTransition(async () => {
      let result;
      if (selectedRight.kind === "payment") { result = await manualReconcile(societyId, { transactionId: selectedTxId, paymentId: selectedRight.id }); }
      else if (selectedRight.kind === "invoice") { result = await reconcileWithInvoice(societyId, selectedTxId, selectedRight.id); }
      else { result = await reconcileWithLoanLine(societyId, selectedTxId, selectedRight.id); }
      if (result.success) { toast.success("Rapprochement effectué"); setSelectedTxId(null); setSelectedRight(null); }
      else { toast.error(result.error ?? "Erreur rapprochement"); }
    });
  }
  const totalRight = payments.length + pendingInvoices.length + loanLines.length;
  if (transactions.length === 0 && totalRight === 0) {
    return (<Card><CardContent className="flex flex-col items-center justify-center py-12"><GitMerge className="h-12 w-12 text-[var(--color-status-positive)] mb-4" /><h3 className="text-lg font-semibold mb-2">Tout est à jour !</h3><p className="text-sm text-muted-foreground">Toutes les transactions et paiements sont rapprochés.</p></CardContent></Card>);
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Sélectionnez une transaction (gauche) et un élément (droite).</p>
        <Button onClick={handleAutoReconcile} disabled={isPending} variant="outline">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Rapprochement automatique
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4 text-muted-foreground" />Transactions ({transactions.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {transactions.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-6">Aucune transaction à rapprocher</p>) : (
              <div className="divide-y">{transactions.map((tx) => (
                <button key={tx.id} onClick={() => toggleTx(tx.id)}
                  className={"w-full flex items-center justify-between p-4 text-left transition-colors " + (selectedTxId === tx.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/50")}
                >
                  <div>
                    <p className="text-sm font-medium">{tx.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.transactionDate)}{tx.reference && " · " + tx.reference}</p>
                  </div>
                  <span className={"text-sm font-medium tabular-nums " + (tx.amount >= 0 ? "text-[var(--color-status-positive)]" : "text-destructive")}>{tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}</span>
                </button>
              ))}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" />Éléments à rapprocher</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="payments" className="w-full">
              <div className="px-4 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="payments" className="flex-1 gap-1.5">Paiements{payments.length > 0 && <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">{payments.length}</Badge>}</TabsTrigger>
                  <TabsTrigger value="invoices" className="flex-1 gap-1.5">Loyers{pendingInvoices.length > 0 && <Badge className="text-xs px-1.5 py-0 h-4 bg-blue-100 text-blue-700 hover:bg-blue-100">{pendingInvoices.length}</Badge>}</TabsTrigger>
                  <TabsTrigger value="loans" className="flex-1 gap-1.5">Prêts{loanLines.length > 0 && <Badge className="text-xs px-1.5 py-0 h-4 bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] hover:bg-[var(--color-status-caution-bg)]">{loanLines.length}</Badge>}</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="payments" className="mt-0">
                {payments.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Aucun paiement à rapprocher</p> : (
                  <div className="divide-y">{payments.map((p) => {
                    const isSel = selectedRight?.kind === "payment" && selectedRight.id === p.id;
                    return (<button key={p.id} onClick={() => toggleRight({ kind: "payment", id: p.id })}
                      className={"w-full flex items-center justify-between p-4 text-left transition-colors " + (isSel ? "bg-[var(--color-status-positive-bg)] border-l-2 border-[var(--color-status-positive)]" : "hover:bg-muted/50")}
                    >
                      <div><p className="text-sm font-medium">{tenantLabel(p.invoice.tenant)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.paidAt)}{p.method && " · " + p.method}{p.reference && " · " + p.reference}</p></div>
                      <span className="text-sm font-medium tabular-nums text-[var(--color-status-positive)]">{formatCurrency(p.amount)}</span>
                    </button>);
                  })}</div>
                )}
              </TabsContent>
              <TabsContent value="invoices" className="mt-0">
                {pendingInvoices.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Aucune facture en attente</p> : (
                  <div className="divide-y">{pendingInvoices.map((inv) => {
                    const isSel = selectedRight?.kind === "invoice" && selectedRight.id === inv.id;
                    const isOverdue = inv.status === "EN_RETARD";
                    return (<button key={inv.id} onClick={() => toggleRight({ kind: "invoice", id: inv.id })}
                      className={"w-full flex items-center justify-between p-4 text-left transition-colors " + (isSel ? "bg-blue-500/10 border-l-2 border-blue-500" : "hover:bg-muted/50")}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{tenantLabel(inv.tenant)}</p>
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-blue-600 border-blue-200 dark:border-blue-800 shrink-0">{INVOICE_TYPE_LABELS[inv.invoiceType] ?? inv.invoiceType}</Badge>
                          {isOverdue && <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4 shrink-0">En retard</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{inv.invoiceNumber} · Éch. {formatDate(inv.dueDate)}</p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400 ml-2 shrink-0">{formatCurrency(inv.totalTTC)}</span>
                    </button>);
                  })}</div>
                )}
              </TabsContent>
              <TabsContent value="loans" className="mt-0">
                {loanLines.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Aucune échéance de prêt en attente</p> : (
                  <div className="divide-y">{loanLines.map((line) => {
                    const isSel = selectedRight?.kind === "loanLine" && selectedRight.id === line.id;
                    return (<button key={line.id} onClick={() => toggleRight({ kind: "loanLine", id: line.id })}
                      className={"w-full flex items-start justify-between p-4 text-left transition-colors " + (isSel ? "bg-[var(--color-status-caution-bg)] border-l-2 border-[var(--color-status-caution)]" : "hover:bg-muted/50")}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{line.loan.label}</p>
                        <p className="text-xs text-muted-foreground">{line.loan.lender} · Éch. n°{line.period} · {formatDate(line.dueDate)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Capital {formatCurrency(line.principalPayment)} · Intérêts {formatCurrency(line.interestPayment)}{line.insurancePayment > 0 && " · Ass. " + formatCurrency(line.insurancePayment)}</p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-[var(--color-status-caution)] ml-2 shrink-0">{formatCurrency(line.totalPayment)}</span>
                    </button>);
                  })}</div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      {selectedTxId && selectedRight && (
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">Transaction sélectionnée</Badge>
            <span className="text-muted-foreground">+</span>
            <Badge variant="outline" className={selectedRight.kind === "payment" ? "border-[var(--color-status-positive)] text-[var(--color-status-positive)]" : selectedRight.kind === "invoice" ? "border-blue-500 text-blue-600" : "border-[var(--color-status-caution)] text-[var(--color-status-caution)]"}>
              {selectedRight.kind === "payment" ? "Paiement sélectionné" : selectedRight.kind === "invoice" ? "Facture sélectionnée" : "Échéance prêt sélectionnée"}
            </Badge>
          </div>
          <Button onClick={handleReconcile} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
            Rapprocher
          </Button>
        </div>
      )}
    </div>
  );
}

