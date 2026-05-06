import {
  getUnreconciledTransactions,
  getUnreconciledPayments,
  getReconciledItems,
  getPendingInvoices,
  getUpcomingLoanLines,
  getSupplierInvoicesToReconcile,
  getBankReconciliationSuggestions,
  getUnreconciledBalanceAdjustments,
} from "@/actions/bank-reconciliation";
import { getBankAccountSummaryById } from "@/actions/bank";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";
import ReconciliationClient from "./_components/reconciliation-client";
import { Suspense } from "react";

export default async function RapprochementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const accountPromise = getBankAccountSummaryById(societyId, id);
  const reconciledPromise = getReconciledItems(societyId, id);
  const reconciliationDataPromise = Promise.all([
    getUnreconciledTransactions(societyId, id),
    getUnreconciledPayments(societyId),
    getPendingInvoices(societyId),
    getUpcomingLoanLines(societyId),
    getSupplierInvoicesToReconcile(societyId),
    getBankReconciliationSuggestions(societyId, id),
    getUnreconciledBalanceAdjustments(societyId),
  ]);

  const account = await accountPromise;
  if (!account) notFound();

  const [transactions, payments, pendingInvoices, loanLines, supplierInvoices, suggestions, balanceAdjustments] = await reconciliationDataPromise;

  const totalRight = payments.length + pendingInvoices.length + loanLines.length + supplierInvoices.length + balanceAdjustments.length;

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Transactions non rapprochées</p>
            <p className={`text-2xl font-bold ${transactions.length > 0 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]"}`}>
              {transactions.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Règlements saisis</p>
            <p className={`text-2xl font-bold ${payments.length > 0 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]"}`}>
              {payments.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Loyers et factures en attente</p>
            <p className={`text-2xl font-bold ${pendingInvoices.length > 0 ? "text-blue-600" : "text-[var(--color-status-positive)]"}`}>
              {pendingInvoices.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Échéances de prêts</p>
            <p className={`text-2xl font-bold ${loanLines.length > 0 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]"}`}>
              {loanLines.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Fournisseurs</p>
            <p className={`text-2xl font-bold ${supplierInvoices.length > 0 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]"}`}>
              {supplierInvoices.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Reprises de solde</p>
            <p className={`text-2xl font-bold ${balanceAdjustments.length > 0 ? "text-purple-600" : "text-[var(--color-status-positive)]"}`}>
              {balanceAdjustments.length}
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
        supplierInvoices={supplierInvoices}
        suggestions={suggestions}
        balanceAdjustments={balanceAdjustments}
      />

      <Suspense fallback={<ReconciledItemsSkeleton />}>
        <ReconciledItemsSection promise={reconciledPromise} societyId={societyId} />
      </Suspense>
    </div>
  );
}

type ReconciledItems = Awaited<ReturnType<typeof getReconciledItems>>;

async function ReconciledItemsSection({
  promise,
  societyId,
}: {
  promise: Promise<ReconciledItems>;
  societyId: string;
}) {
  const reconciled = await promise;

  if (reconciled.length === 0) return null;

  return (
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
                <span className={`text-sm font-medium tabular-nums ${r.transaction.amount >= 0 ? "text-[var(--color-status-positive)]" : "text-destructive"}`}>
                  {r.transaction.amount >= 0 ? "+" : ""}{formatCurrency(r.transaction.amount)}
                </span>
                <Badge variant="success" className="text-xs">Rapproché</Badge>
                {r.transaction.journalEntryId ? (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <FileText className="h-3 w-3" />
                    BQUE générée
                  </Badge>
                ) : (
                  <GenerateJournalEntryButton
                    societyId={societyId}
                    transactionId={r.transaction.id}
                  />
                )}
                <UnreconcileButton societyId={societyId} reconciliationId={r.id} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReconciledItemsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

function GenerateJournalEntryButton({
  societyId,
  transactionId,
}: {
  societyId: string;
  transactionId: string;
}) {
  return (
    <form action={async () => {
      "use server";
      const { generateJournalEntry } = await import("@/actions/bank-reconciliation");
      await generateJournalEntry(societyId, transactionId);
    }}>
      <button type="submit" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
        Générer BQUE
      </button>
    </form>
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
