"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, FileText, GitMerge, Loader2, Zap, Receipt, Banknote, Building2 } from "lucide-react";
import {
  autoReconcile,
  generateJournalEntry,
  manualReconcile,
  reconcileWithJournalEntry,
  reconcileWithInvoice,
  reconcileWithLoanLine,
  reconcileWithSupplierInvoice,
  reconcileWithBalanceAdjustment,
  type ReconciliationCandidate,
  type BankReconciliationSuggestion,
} from "@/actions/bank-reconciliation";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/utils";

type Transaction = {
  id: string;
  transactionDate: Date;
  amount: number;
  label: string;
  reference: string | null;
  journalEntryId: string | null;
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
  };
};
type PendingInvoice = {
  id: string;
  invoiceNumber: string | null;
  invoiceType: string;
  totalTTC: number;
  dueDate: Date;
  status: string;
  tenant: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};
type LoanLine = {
  id: string;
  period: number;
  dueDate: Date;
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  principalPaidAt: Date | null;
  interestPaidAt: Date | null;
  insurancePaidAt: Date | null;
  principalBankTransactionId: string | null;
  interestBankTransactionId: string | null;
  insuranceBankTransactionId: string | null;
  loan: { id: string; label: string; lender: string };
};
type SupplierInvoice = {
  id: string;
  supplierName: string | null;
  amountTTC: number | null;
  dueDate: Date | null;
  status: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  bankAccountId: string | null;
  bankJournalEntryId: string | null;
};

type BalanceAdjustment = {
  id: string;
  label: string;
  amount: number;
  dueDate: Date;
  reference: string | null;
  periodLabel: string | null;
  tenant: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
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

function LoanComponentStatus({
  label,
  amount,
  paidAt,
}: {
  label: string;
  amount: number;
  paidAt: Date | null;
}) {
  if (amount <= 0.01) return null;

  return (
    <span className="inline-flex items-center gap-1">
      {label} {formatCurrency(amount)}
      {paidAt && (
        <span className="inline-flex h-4 items-center rounded-full border border-border px-1 text-[10px] text-[var(--color-status-positive)]">
          pointé
        </span>
      )}
    </span>
  );
}

interface ReconciliationClientProps {
  societyId: string;
  bankAccountId: string;
  transactions: Transaction[];
  payments: Payment[];
  pendingInvoices: PendingInvoice[];
  loanLines: LoanLine[];
  supplierInvoices: SupplierInvoice[];
  suggestions: BankReconciliationSuggestion[];
  balanceAdjustments: BalanceAdjustment[];
}

export default function ReconciliationClient({
  societyId,
  bankAccountId,
  transactions,
  payments,
  pendingInvoices,
  loanLines,
  supplierInvoices,
  suggestions,
  balanceAdjustments,
}: ReconciliationClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reconcileTargetId, setReconcileTargetId] = useState<string | null>(
    null
  );
  const [journalTargetId, setJournalTargetId] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);

  function toggleTx(id: string) {
    setSelectedTxId((p) => (p === id ? null : id));
  }

  function handleAutoReconcile() {
    setOperationNotice({ type: "info", message: "Rapprochement automatique en cours..." });
    startTransition(() => {
      void (async () => {
        try {
          const result = await autoReconcile(societyId, bankAccountId);
          if (result.success) {
            const n = result.data?.matched ?? 0;
            const message =
              n === 0
                ? "Aucun rapprochement automatique trouvé"
                : n +
                  " rapprochement" +
                  (n > 1 ? "s" : "") +
                  " effectué" +
                  (n > 1 ? "s" : "");
            toast.success(message);
            setOperationNotice({ type: "success", message });
            router.refresh();
          } else {
            const message = result.error ?? "Erreur rapprochement automatique";
            toast.error(message);
            setOperationNotice({ type: "error", message });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erreur rapprochement automatique";
          toast.error(message);
          setOperationNotice({ type: "error", message });
        }
      })();
    });
  }

  function handleGenerateJournalEntry() {
    if (!selectedTxId) return;
    setJournalTargetId(selectedTxId);
    startTransition(async () => {
      const result = await generateJournalEntry(societyId, selectedTxId);
      if (result.success) {
        toast.success("Écriture BQUE générée");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la génération de l'écriture");
      }
      setJournalTargetId(null);
    });
  }

  function handleReconcileInline(
    kind: "payment" | "invoice" | "loanLine" | "supplierInvoice" | "balanceAdjustment",
    rightId: string
  ) {
    const transactionId = selectedTxId;
    if (!transactionId) {
      const message = "Sélectionnez une transaction bancaire avant de rapprocher";
      toast.error(message);
      setOperationNotice({ type: "error", message });
      return;
    }
    setReconcileTargetId(rightId);
    setOperationNotice({ type: "info", message: "Rapprochement en cours..." });
    startTransition(() => {
      void (async () => {
        try {
          let result;
          if (kind === "payment") {
            result = await manualReconcile(societyId, {
              transactionId,
              paymentId: rightId,
            });
          } else if (kind === "invoice") {
            result = await reconcileWithInvoice(societyId, transactionId, rightId);
          } else if (kind === "loanLine") {
            result = await reconcileWithLoanLine(societyId, transactionId, rightId);
          } else if (kind === "balanceAdjustment") {
            result = await reconcileWithBalanceAdjustment(societyId, transactionId, rightId);
          } else {
            result = await reconcileWithSupplierInvoice(societyId, transactionId, rightId);
          }
          if (result.success) {
            const message = "Rapprochement effectué";
            toast.success(message);
            setOperationNotice({ type: "success", message });
            setSelectedTxId(null);
            router.refresh();
          } else {
            const message = result.error ?? "Erreur rapprochement";
            toast.error(message);
            setOperationNotice({ type: "error", message });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erreur rapprochement";
          toast.error(message);
          setOperationNotice({ type: "error", message });
        } finally {
          setReconcileTargetId(null);
        }
      })();
    });
  }

  function handleApplySuggestion(candidate: ReconciliationCandidate) {
    const transactionId = selectedTxId;
    if (!transactionId) {
      const message = "Sélectionnez une transaction bancaire avant d'appliquer une suggestion";
      toast.error(message);
      setOperationNotice({ type: "error", message });
      return;
    }
    setReconcileTargetId(candidate.targetId);
    setOperationNotice({ type: "info", message: `Application de la suggestion ${candidate.label}...` });
    startTransition(() => {
      void (async () => {
        try {
          let result;
          if (candidate.kind === "payment") {
            result = await manualReconcile(societyId, {
              transactionId,
              paymentId: candidate.targetId,
            });
          } else if (candidate.kind === "invoice") {
            result = await reconcileWithInvoice(societyId, transactionId, candidate.targetId);
          } else if (candidate.kind === "loanLine") {
            result = await reconcileWithLoanLine(societyId, transactionId, candidate.targetId);
          } else if (candidate.kind === "supplierInvoice") {
            result = await reconcileWithSupplierInvoice(societyId, transactionId, candidate.targetId);
          } else if (candidate.kind === "balanceAdjustment") {
            result = await reconcileWithBalanceAdjustment(societyId, transactionId, candidate.targetId);
          } else {
            result = await reconcileWithJournalEntry(societyId, transactionId, candidate.targetId);
          }

          if (result.success) {
            const message = "Suggestion appliquée";
            toast.success(message);
            setOperationNotice({ type: "success", message });
            setSelectedTxId(null);
            router.refresh();
          } else {
            const message = result.error ?? "Impossible d'appliquer la suggestion";
            toast.error(message);
            setOperationNotice({ type: "error", message });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Impossible d'appliquer la suggestion";
          toast.error(message);
          setOperationNotice({ type: "error", message });
        } finally {
          setReconcileTargetId(null);
        }
      })();
    });
  }

  const totalRight =
    payments.length + pendingInvoices.length + loanLines.length + supplierInvoices.length + balanceAdjustments.length;
  const selectedTx = selectedTxId
    ? transactions.find((t) => t.id === selectedTxId)
    : null;
  const suggestionsByTransaction = new Map(
    suggestions.map((suggestion) => [suggestion.transactionId, suggestion])
  );
  const selectedSuggestion = selectedTxId ? suggestionsByTransaction.get(selectedTxId) : null;

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

const KIND_LABELS: Record<string, string> = {
  payment: "règlement",
  invoice: "loyer / facture",
  loanLine: "prêt",
  supplierInvoice: "fournisseur",
  balanceAdjustment: "reprise de solde",
};

  const reconcileBtn = (
    kind: "payment" | "invoice" | "loanLine" | "supplierInvoice" | "balanceAdjustment",
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
        {operationNotice && (
          <div
            className={
              "w-full rounded-md border px-3 py-2 text-sm " +
              (operationNotice.type === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : operationNotice.type === "success"
                  ? "border-[var(--color-status-positive)]/30 bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]"
                  : "border-border bg-muted/40 text-muted-foreground")
            }
          >
            {operationNotice.message}
          </div>
        )}
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
        {selectedTx && (
          selectedTx.journalEntryId ? (
            <Badge variant="outline" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Écriture BQUE générée
            </Badge>
          ) : (
            <Button
              onClick={handleGenerateJournalEntry}
              disabled={isPending}
              variant="outline"
            >
              {journalTargetId === selectedTx.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Générer écriture BQUE
            </Button>
          )
        )}
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
                      {tx.journalEntryId && (
                        <Badge variant="outline" className="mt-2 gap-1 text-[10px]">
                          <FileText className="h-3 w-3" />
                          BQUE
                        </Badge>
                      )}
                      {suggestionsByTransaction.get(tx.id)?.bestCandidate && (
                        <Badge variant="warning" className="mt-2 ml-1 text-[10px]">
                          Suggestion {suggestionsByTransaction.get(tx.id)?.bestCandidate?.score}%
                        </Badge>
                      )}
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
            {selectedSuggestion?.bestCandidate && (
              <div className="border-b border-border/60 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggestions
                </p>
                <div className="mt-2 space-y-2">
                  {selectedSuggestion.candidates.slice(0, 3).map((candidate) => (
                    <button
                      key={`${candidate.kind}-${candidate.targetId}`}
                      type="button"
                      onClick={() => handleApplySuggestion(candidate)}
                      disabled={isPending}
                      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-status-caution-bg)]/60 p-3 text-left transition-colors hover:bg-[var(--color-status-caution-bg)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{candidate.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {KIND_LABELS[candidate.kind] ?? candidate.kind} · {candidate.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">{candidate.score}%</Badge>
                        <span className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs">
                          {isPending && reconcileTargetId === candidate.targetId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Appliquer
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Tabs defaultValue="payments" className="w-full">
              <div className="px-4 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="payments" className="flex-1 gap-1.5">
                    Règlements
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
                  <TabsTrigger value="suppliers" className="flex-1 gap-1.5">
                    Fournisseurs
                    {supplierInvoices.length > 0 && (
                      <Badge className="text-xs px-1.5 py-0 h-4 bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] hover:bg-[var(--color-status-caution-bg)]">
                        {supplierInvoices.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="adjustments" className="flex-1 gap-1.5">
                    Reprises
                    {balanceAdjustments.length > 0 && (
                      <Badge className="text-xs px-1.5 py-0 h-4 bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400">
                        {balanceAdjustments.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Paiements */}
              <TabsContent value="payments" className="mt-0 max-h-[520px] overflow-y-auto">
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucun règlement à rapprocher
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
                            <LoanComponentStatus
                              label="Capital"
                              amount={line.principalPayment}
                              paidAt={line.principalPaidAt}
                            />
                            {" · "}
                            <LoanComponentStatus
                              label="Intérêts"
                              amount={line.interestPayment}
                              paidAt={line.interestPaidAt}
                            />
                            {line.insurancePayment > 0 && (
                              <>
                                {" · "}
                                <LoanComponentStatus
                                  label="Ass."
                                  amount={line.insurancePayment}
                                  paidAt={line.insurancePaidAt}
                                />
                              </>
                            )}
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

              {/* Factures fournisseurs */}
              <TabsContent value="suppliers" className="mt-0 max-h-[520px] overflow-y-auto">
                {supplierInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucune facture fournisseur à rapprocher
                  </p>
                ) : (
                  <div className="divide-y">
                    {supplierInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-sm font-medium truncate">
                              {invoice.supplierName ?? "Fournisseur non renseigné"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {invoice.dueDate ? `Éch. ${formatDate(invoice.dueDate)}` : "Échéance non renseignée"}
                            {invoice.paymentMethod && ` · ${invoice.paymentMethod}`}
                            {invoice.paymentReference && ` · ${invoice.paymentReference}`}
                            {invoice.bankJournalEntryId && " · BQUE"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-2 shrink-0">
                          <span className="text-sm font-medium tabular-nums text-destructive">
                            {formatCurrency(invoice.amountTTC ?? 0)}
                          </span>
                          {selectedTxId && reconcileBtn("supplierInvoice", invoice.id)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Reprises de solde */}
              <TabsContent value="adjustments" className="mt-0 max-h-[520px] overflow-y-auto">
                {balanceAdjustments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucune reprise de solde à rapprocher
                  </p>
                ) : (
                  <div className="divide-y">
                    {balanceAdjustments.map((adj) => (
                      <div
                        key={adj.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{tenantLabel(adj.tenant)}</p>
                          <p className="text-xs text-muted-foreground">
                            {adj.label}
                            {adj.periodLabel && ` · ${adj.periodLabel}`}
                            {adj.reference && ` · Réf. ${adj.reference}`}
                            {` · Éch. ${new Date(adj.dueDate).toLocaleDateString("fr-FR")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-2 shrink-0">
                          <span className="text-sm font-medium tabular-nums text-purple-600 dark:text-purple-400">
                            {formatCurrency(adj.amount)}
                          </span>
                          {selectedTxId && reconcileBtn("balanceAdjustment", adj.id)}
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
