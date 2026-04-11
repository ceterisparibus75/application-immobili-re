"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitMerge, Loader2, Zap, Receipt, Banknote, Check } from "lucide-react";
import {
  autoReconcile,
  manualReconcile,
  reconcileWithInvoice,
  reconcileWithLoanLine,
} from "@/actions/bank-reconciliation";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/utils";

type Transaction = {
  id: string;
  transactionDate: Date;
  amount: number;
  label: string;
  reference: string | null;
};
type Payment = {
  id: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  reference: string | null;
  invoice: {
    tenant: {
      companyName: string | null;
      firstName: string | null;
      lastName: string | null;
    } | null;
    lease: {
      lot: { building: { name: string } };
      tenant: {
        companyName: string | null;
        firstName: string | null;
        lastName: string | null;
      };
    } | null;
  };
};
type PendingInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  totalTTC: number;
  dueDate: Date;
  status: string;
  tenant: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  _count: { payments: number };
};
type LoanLine = {
  id: string;
  period: number;
  dueDate: Date;
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  remainingBalance: number;
  isPaid: boolean;
  paidAt: Date | null;
  loan: { id: string; label: string; lender: string };
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  APPEL_LOYER: "Appel de loyer",
  QUITTANCE: "Quittance",
  REGULARISATION_CHARGES: "Régul. charges",
  REFACTURATION: "Refacturation",
  AVOIR: "Avoir",
};

function tenantLabel(
  t: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null
): string {
  if (!t) return "—";
  return (
    t.companyName ??
    (((t.firstName ?? "") + " " + (t.lastName ?? "")).trim() || "—")
  );
}

interface ReconciliationClientProps {
  societyId: string;
  bankAccountId: string;
  transactions: Transaction[];
  payments: Payment[];
  pendingInvoices: PendingInvoice[];
  loanLines: LoanLine[];
  reconciled: unknown[];
}

export default function ReconciliationClient({
  societyId,
  bankAccountId,
  transactions,
  payments,
  pendingInvoices,
  loanLines,
}: ReconciliationClientProps) {
  const [isPending, startTransition] = useTransition();
  const [reconcileTargetId, setReconcileTargetId] = useState<string | null>(
    null
  );
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  function toggleTx(id: string) {
    setSelectedTxId((p) => (p === id ? null : id));
  }

  function handleAutoReconcile() {
    startTransition(async () => {
      const result = await autoReconcile(societyId, bankAccountId);
      if (result.success) {
        const n = result.data?.matched ?? 0;
        toast.success(
          n === 0
            ? "Aucun rapprochement automatique trouvé"
            : n +
                " rapprochement" +
                (n > 1 ? "s" : "") +
                " effectué" +
                (n > 1 ? "s" : "")
        );
      } else {
        toast.error(result.error ?? "Erreur rapprochement automatique");
      }
    });
  }

  function handleReconcileInline(
    kind: "payment" | "invoice" | "loanLine",
    rightId: string
  ) {
    if (!selectedTxId) return;
    setReconcileTargetId(rightId);
    startTransition(async () => {
      let result;
      if (kind === "payment") {
        result = await manualReconcile(societyId, {
          transactionId: selectedTxId,
          paymentId: rightId,
        });
      } else if (kind === "invoice") {
        result = await reconcileWithInvoice(societyId, selectedTxId, rightId);
      } else {
        result = await reconcileWithLoanLine(societyId, selectedTxId, rightId);
      }
      if (result.success) {
        toast.success("Rapprochement effectué");
        setSelectedTxId(null);
      } else {
        toast.error(result.error ?? "Erreur rapprochement");
      }
      setReconcileTargetId(null);
    });
  }

  const totalRight =
    payments.length + pendingInvoices.length + loanLines.length;
  const selectedTx = selectedTxId
    ? transactions.find((t) => t.id === selectedTxId)
    : null;

  if (transactions.length === 0 && totalRight === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GitMerge className="h-12 w-12 text-[var(--color-status-positive)] mb-4" />
          <h3 className="text-lg font-semibold mb-2">Tout est à jour !</h3>
          <p className="text-sm text-muted-foreground">
            Toutes les transactions et paiements sont rapprochés.
          </p>
        </CardContent>
      </Card>
    );
  }

  const reconcileBtn = (
    kind: "payment" | "invoice" | "loanLine",
    id: string
  ) => (
    <Button
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        handleReconcileInline(kind, id);
      }}
      disabled={isPending}
      className="shrink-0 h-7 text-xs gap-1 px-2.5"
    >
      {isPending && reconcileTargetId === id ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Check className="h-3 w-3" />
      )}
      Rapprocher
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {selectedTx ? (
            <>
              Transaction sélectionnée :{" "}
              <span className="font-medium text-foreground">
                {selectedTx.label}
              </span>{" "}
              (
              <span
                className={
                  "font-medium tabular-nums " +
                  (selectedTx.amount >= 0
                    ? "text-[var(--color-status-positive)]"
                    : "text-destructive")
                }
              >
                {selectedTx.amount >= 0 ? "+" : ""}
                {formatCurrency(selectedTx.amount)}
              </span>
              )
            </>
          ) : (
            "Sélectionnez une transaction à gauche, puis rapprochez-la à droite."
          )}
        </p>
        <Button
          onClick={handleAutoReconcile}
          disabled={isPending}
          variant="outline"
        >
          {isPending && !reconcileTargetId ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Rapprochement automatique
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Colonne gauche : Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              Transactions ({transactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-y-auto">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucune transaction à rapprocher
              </p>
            ) : (
              <div className="divide-y">
                {transactions.map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => toggleTx(tx.id)}
                    className={
                      "w-full flex items-center justify-between p-4 text-left transition-colors " +
                      (selectedTxId === tx.id
                        ? "bg-primary/10 border-l-3 border-primary"
                        : "hover:bg-muted/50")
                    }
                  >
                    <div>
                      <p className="text-sm font-medium">{tx.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.transactionDate)}
                        {tx.reference && ` · ${tx.reference}`}
                      </p>
                    </div>
                    <span
                      className={
                        "text-sm font-medium tabular-nums " +
                        (tx.amount >= 0
                          ? "text-[var(--color-status-positive)]"
                          : "text-destructive")
                      }
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {formatCurrency(tx.amount)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colonne droite : Éléments à rapprocher */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Éléments à rapprocher
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="payments" className="w-full">
              <div className="px-4 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="payments" className="flex-1 gap-1.5">
                    Paiements
                    {payments.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0 h-4"
                      >
                        {payments.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="flex-1 gap-1.5">
                    Loyers
                    {pendingInvoices.length > 0 && (
                      <Badge className="text-xs px-1.5 py-0 h-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
                        {pendingInvoices.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="loans" className="flex-1 gap-1.5">
                    Prêts
                    {loanLines.length > 0 && (
                      <Badge className="text-xs px-1.5 py-0 h-4 bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] hover:bg-[var(--color-status-caution-bg)]">
                        {loanLines.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Paiements */}
              <TabsContent value="payments" className="mt-0 max-h-[520px] overflow-y-auto">
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucun paiement à rapprocher
                  </p>
                ) : (
                  <div className="divide-y">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {tenantLabel(p.invoice.tenant)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(p.paidAt)}
                            {p.method && ` · ${p.method}`}
                            {p.reference && ` · ${p.reference}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-2 shrink-0">
                          <span className="text-sm font-medium tabular-nums text-[var(--color-status-positive)]">
                            {formatCurrency(p.amount)}
                          </span>
                          {selectedTxId && reconcileBtn("payment", p.id)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Factures / Loyers */}
              <TabsContent value="invoices" className="mt-0 max-h-[520px] overflow-y-auto">
                {pendingInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucune facture en attente
                  </p>
                ) : (
                  <div className="divide-y">
                    {pendingInvoices.map((inv) => {
                      const isOverdue = inv.status === "EN_RETARD";
                      return (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">
                                {tenantLabel(inv.tenant)}
                              </p>
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0 h-4 text-blue-600 border-blue-200 dark:border-blue-800 shrink-0"
                              >
                                {INVOICE_TYPE_LABELS[inv.invoiceType] ??
                                  inv.invoiceType}
                              </Badge>
                              {isOverdue && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs px-1.5 py-0 h-4 shrink-0"
                                >
                                  En retard
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {inv.invoiceNumber} · Éch.{" "}
                              {formatDate(inv.dueDate)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 ml-2 shrink-0">
                            <span className="text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400">
                              {formatCurrency(inv.totalTTC)}
                            </span>
                            {selectedTxId && reconcileBtn("invoice", inv.id)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Échéances de prêts */}
              <TabsContent value="loans" className="mt-0 max-h-[520px] overflow-y-auto">
                {loanLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucune échéance de prêt en attente
                  </p>
                ) : (
                  <div className="divide-y">
                    {loanLines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-start justify-between p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {line.loan.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {line.loan.lender} · Éch. n°
                            {line.period} · {formatDate(line.dueDate)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Capital {formatCurrency(line.principalPayment)}
                            {" "}· Intérêts{" "}
                            {formatCurrency(line.interestPayment)}
                            {line.insurancePayment > 0 &&
                              ` · Ass. ${formatCurrency(line.insurancePayment)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-2 shrink-0">
                          <span className="text-sm font-medium tabular-nums text-[var(--color-status-caution)]">
                            {formatCurrency(line.totalPayment)}
                          </span>
                          {selectedTxId && reconcileBtn("loanLine", line.id)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
