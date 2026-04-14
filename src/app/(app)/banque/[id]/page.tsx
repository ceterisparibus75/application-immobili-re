import { getBankAccountById } from "@/actions/bank";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { isNeutralCategory } from "@/lib/cashflow-categories";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  GitMerge,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Info,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AddTransactionForm from "./_components/add-transaction-form";
import SyncButton from "./_components/sync-button";
import RecalculateButton from "./_components/recalculate-button";
import { ExportTransactions } from "@/components/exports/export-transactions";

export default async function BankAccountDetailPage({
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

  const credits = account.transactions
    .filter((t) => t.amount > 0 && !isNeutralCategory(t.category ?? ""))
    .reduce((s, t) => s + t.amount, 0);
  const debits = account.transactions
    .filter((t) => t.amount < 0 && !isNeutralCategory(t.category ?? ""))
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/banque">
            <Button variant="ghost" size="icon" className="text-[var(--color-brand-deep)]">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">
                {account.accountName}
              </h1>
              <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                account.isActive ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : "bg-gray-100 text-gray-500"
              }`}>
                {account.isActive ? "Actif" : "Inactif"}
              </span>
              {account.connection && (
                <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-brand-light)] text-[var(--color-brand-blue)]">
                  {account.qontoAccountId ? "Qonto" : "Open Banking"} · {account.connection.institutionName}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">
              {account.bankName} — {account.ibanMasked}
            </p>
            {account.lastSyncAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Dernière sync : {formatDate(account.lastSyncAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ExportTransactions data={account.transactions.map((t) => ({
            transactionDate: new Date(t.transactionDate).toLocaleDateString("fr-FR"),
            label: t.label,
            amount: t.amount,
            reference: t.reference ?? "",
            category: t.category ?? "",
            isReconciled: t.isReconciled,
          }))} />
          <RecalculateButton bankAccountId={account.id} societyId={societyId} />
          {(account.powensAccountId || account.qontoAccountId) && (
            <SyncButton bankAccountId={account.id} societyId={societyId} />
          )}
          <Link href="/comptabilite/cashflow">
            <Button variant="outline" className="rounded-lg border-border/60 gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Cash-flow
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
          <Link href={`/banque/${id}/rapprochement`}>
            <Button variant="outline" className="rounded-lg border-border/60">
              <GitMerge className="h-4 w-4" />
              Rapprochement
              {account.unreconciledCount > 0 && (
                <span className="ml-1 inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]">
                  {account.unreconciledCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-xs text-muted-foreground mb-1">Solde actuel</p>
          <p className={`text-2xl font-bold tabular-nums ${
            account.currentBalance >= 0 ? "text-[var(--color-brand-deep)]" : "text-[var(--color-status-negative)]"
          }`}>
            {account.currentBalance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--color-status-positive-bg)]">
              <TrendingUp className="h-3 w-3 text-[var(--color-status-positive)]" />
            </div>
            <p className="text-xs text-muted-foreground">Entrées</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-[var(--color-status-positive)]">
            +{credits.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--color-status-negative-bg)]">
              <TrendingDown className="h-3 w-3 text-[var(--color-status-negative)]" />
            </div>
            <p className="text-xs text-muted-foreground">Sorties</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-[var(--color-status-negative)]">
            {debits.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--color-status-caution-bg)]">
              <Clock className="h-3 w-3 text-[var(--color-status-caution)]" />
            </div>
            <p className="text-xs text-muted-foreground">Non rapprochées</p>
          </div>
          <p className={`text-xl font-bold tabular-nums ${account.unreconciledCount > 0 ? "text-[var(--color-status-caution)]" : "text-muted-foreground"}`}>
            {account.unreconciledCount}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transactions */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">
                Transactions récentes ({account.transactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {account.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune transaction enregistrée
                </p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {account.transactions.map((transaction) => {
                    const isCredit = transaction.amount >= 0;
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors"
                      >
                        {/* Icône direction */}
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isCredit
                            ? "bg-[var(--color-status-positive-bg)]"
                            : "bg-[var(--color-status-negative-bg)]"
                        }`}>
                          {isCredit
                            ? <ArrowDownLeft className="h-3.5 w-3.5 text-[var(--color-status-positive)]" />
                            : <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-status-negative)]" />
                          }
                        </div>

                        {/* Libellé + méta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-[var(--color-brand-deep)]" title={transaction.label}>
                            {transaction.label}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {new Date(transaction.transactionDate).toLocaleDateString("fr-FR")}
                            </span>
                            {transaction.reference && (
                              <span className="text-xs text-muted-foreground truncate max-w-32" title={transaction.reference}>
                                · {transaction.reference}
                              </span>
                            )}
                            {transaction.category && (
                              <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-muted-foreground">
                                {transaction.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Montant */}
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold tabular-nums ${
                            isCredit
                              ? "text-[var(--color-status-positive)]"
                              : "text-[var(--color-status-negative)]"
                          }`}>
                            {isCredit ? "+" : ""}{transaction.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </p>
                        </div>

                        {/* Statut */}
                        <div className="shrink-0 w-6 flex justify-center" title={transaction.isReconciled ? "Rapproché" : "En attente"}>
                          {transaction.isReconciled
                            ? <CheckCircle2 className="h-4 w-4 text-[var(--color-status-positive)]" />
                            : <Clock className="h-4 w-4 text-gray-300" />
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panneau latéral */}
        <div className="space-y-6">
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-brand-deep)]">
                <Plus className="h-4 w-4" />
                Ajouter une transaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddTransactionForm
                bankAccountId={account.id}
                societyId={societyId}
              />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-brand-deep)]">
                <Info className="h-4 w-4 text-[var(--color-brand-blue)]" />
                Informations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="py-2 px-3 rounded-lg bg-gray-50/80">
                <p className="text-xs text-muted-foreground">Banque</p>
                <p className="text-sm font-medium text-[var(--color-brand-deep)]">{account.bankName}</p>
              </div>
              <div className="py-2 px-3 rounded-lg bg-gray-50/80">
                <p className="text-xs text-muted-foreground">IBAN (masqué)</p>
                <p className="text-sm font-mono text-[var(--color-brand-deep)]">{account.ibanMasked}</p>
              </div>
              <div className="py-2 px-3 rounded-lg bg-gray-50/80">
                <p className="text-xs text-muted-foreground">Solde initial</p>
                <p className="text-sm text-[var(--color-brand-deep)]">
                  {account.initialBalance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                </p>
              </div>
              {(account.powensAccountId || account.qontoAccountId) && (
                <div className="py-2 px-3 rounded-lg bg-[var(--color-status-positive-bg)]/50">
                  <p className="text-xs text-muted-foreground">
                    {account.qontoAccountId ? "Qonto" : "Open Banking"}
                  </p>
                  <p className="text-sm text-[var(--color-status-positive)] flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Sync automatique active
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
