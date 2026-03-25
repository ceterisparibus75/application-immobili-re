import {
  getUnreconciledTransactions,
  getUnreconciledPayments,
  getReconciledItems,
  getPendingInvoices,
  getUpcomingLoanLines,
} from "@/actions/bank-reconciliation";
import { getBankAccountById } from "@/actions/bank";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";
import ReconciliationClient from "./_components/reconciliation-client";

export default async function RapprochementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const account = await getBankAccountById(societyId, id);
  if (!account) notFound();

  const [transactions, payments, reconciled, pendingInvoices, loanLines] = await Promise.all([
    getUnreconciledTransactions(societyId, id),
    getUnreconciledPayments(societyId),
    getReconciledItems(societyId, id),
    getPendingInvoices(societyId),
    getUpcomingLoanLines(societyId),
  ]);

  const totalRight = payments.length + pendingInvoices.length + loanLines.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href={`/banque/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rapprochement bancaire</h1>
            <p className="text-muted-foreground">{account.accountName} — {account.bankName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""} à rapprocher</Badge>
          <Badge variant="secondary">{totalRight} élément{totalRight !== 1 ? "s" : ""} attendus</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Transactions non rapprochées</p>
            <p className={`text-2xl font-bold ${transactions.length > 0 ? "text-orange-500" : "text-green-600"}`}>
              {transactions.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Paiements enregistrés</p>
            <p className={`text-2xl font-bold ${payments.length > 0 ? "text-orange-500" : "text-green-600"}`}>
              {payments.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Loyers et factures en attente</p>
            <p className={`text-2xl font-bold ${pendingInvoices.length > 0 ? "text-blue-600" : "text-green-600"}`}>
              {pendingInvoices.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Échéances de prêts</p>
            <p className={`text-2xl font-bold ${loanLines.length > 0 ? "text-amber-500" : "text-green-600"}`}>
              {loanLines.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <ReconciliationClient
        societyId={societyId}
        bankAccountId={id}
        transactions={transactions}
        payments={payments}
        pendingInvoices={pendingInvoices}
        loanLines={loanLines}
        reconciled={reconciled}
      />

      {reconciled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rapprochements effectués ({reconciled.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {reconciled.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{r.transaction.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.transaction.transactionDate)} ·{" "}
                      {r.payment.invoice.tenant?.companyName ??
                        `${r.payment.invoice.tenant?.firstName ?? ""} ${r.payment.invoice.tenant?.lastName ?? ""}`.trim()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium tabular-nums ${r.transaction.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                      {r.transaction.amount >= 0 ? "+" : ""}{formatCurrency(r.transaction.amount)}
                    </span>
                    <Badge variant="success" className="text-xs">Rapproché</Badge>
                    <UnreconcileButton societyId={societyId} reconciliationId={r.id} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UnreconcileButton({ societyId, reconciliationId }: { societyId: string; reconciliationId: string }) {
  return (
    <form action={async () => {
      "use server";
      const { unreconcile } = await import("@/actions/bank-reconciliation");
      await unreconcile(societyId, reconciliationId);
    }}>
      <button type="submit" className="text-xs text-muted-foreground hover:text-destructive transition-colors underline">
        Annuler
      </button>
    </form>
  );
}
