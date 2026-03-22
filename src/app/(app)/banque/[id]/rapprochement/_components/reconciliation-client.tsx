"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitMerge, Loader2, Zap } from "lucide-react";
import { autoReconcile, manualReconcile } from "@/actions/bank-reconciliation";
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
      tenant: { companyName: string | null; firstName: string | null; lastName: string | null };
    } | null;
  };
};

type Reconciled = {
  id: string;
  transaction: Transaction;
  payment: {
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
};

interface ReconciliationClientProps {
  societyId: string;
  bankAccountId: string;
  transactions: Transaction[];
  payments: Payment[];
  reconciled: Reconciled[];
}

export default function ReconciliationClient({
  societyId,
  bankAccountId,
  transactions,
  payments,
}: ReconciliationClientProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedPayId, setSelectedPayId] = useState<string | null>(null);

  function handleAutoReconcile() {
    startTransition(async () => {
      const result = await autoReconcile(societyId, bankAccountId);
      if (result.success) {
        toast.success(
          result.data?.matched === 0
            ? "Aucun rapprochement automatique trouvé"
            : `${result.data?.matched} rapprochement${(result.data?.matched ?? 0) > 1 ? "s" : ""} effectué${(result.data?.matched ?? 0) > 1 ? "s" : ""}`
        );
      } else {
        toast.error(result.error ?? "Erreur lors du rapprochement");
      }
    });
  }

  function handleManualReconcile() {
    if (!selectedTxId || !selectedPayId) return;
    startTransition(async () => {
      const result = await manualReconcile(societyId, {
        transactionId: selectedTxId,
        paymentId: selectedPayId,
      });
      if (result.success) {
        toast.success("Rapprochement effectué");
        setSelectedTxId(null);
        setSelectedPayId(null);
      } else {
        toast.error(result.error ?? "Erreur lors du rapprochement");
      }
    });
  }

  const tenantName = (payment: Payment) => {
    const t = payment.invoice.tenant;
    if (!t) return "—";
    return t.companyName ?? (`${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—");
  };

  if (transactions.length === 0 && payments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GitMerge className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Tout est à jour !</h3>
          <p className="text-sm text-muted-foreground">
            Toutes les transactions et paiements sont rapprochés.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rapprochement automatique */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Sélectionnez une transaction et un paiement pour les rapprocher manuellement, ou utilisez le rapprochement automatique.
        </p>
        <Button onClick={handleAutoReconcile} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Rapprochement automatique
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Transactions à rapprocher */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Transactions ({transactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucune transaction à rapprocher
              </p>
            ) : (
              <div className="divide-y">
                {transactions.map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTxId(tx.id === selectedTxId ? null : tx.id)}
                    className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                      selectedTxId === tx.id
                        ? "bg-primary/10 border-l-2 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{tx.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.transactionDate)}
                        {tx.reference && ` · ${tx.reference}`}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        tx.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paiements à rapprocher */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Paiements ({payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun paiement à rapprocher
              </p>
            ) : (
              <div className="divide-y">
                {payments.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPayId(p.id === selectedPayId ? null : p.id)}
                    className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                      selectedPayId === p.id
                        ? "bg-primary/10 border-l-2 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{tenantName(p)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.paidAt)}
                        {p.method && ` · ${p.method}`}
                        {p.reference && ` · ${p.reference}`}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-green-600 dark:text-green-400">
                      {formatCurrency(p.amount)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bouton rapprochement manuel */}
      {selectedTxId && selectedPayId && (
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Transaction sélectionnée</Badge>
            <span className="text-muted-foreground">+</span>
            <Badge variant="outline">Paiement sélectionné</Badge>
          </div>
          <Button onClick={handleManualReconcile} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
            Rapprocher
          </Button>
        </div>
      )}
    </div>
  );
}
