import { getBankAccountById } from "@/actions/bank";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  GitMerge,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AddTransactionForm from "./_components/add-transaction-form";
import SyncButton from "./_components/sync-button";
import RecalculateButton from "./_components/recalculate-button";

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
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const debits = account.transactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/banque">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {account.accountName}
              </h1>
              <Badge variant={account.isActive ? "success" : "secondary"}>
                {account.isActive ? "Actif" : "Inactif"}
              </Badge>
              {account.connection && (
                <Badge variant="outline" className="text-xs">
                  {account.qontoAccountId ? "Qonto" : "Open Banking"} · {account.connection.institutionName}
                </Badge>
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
          <RecalculateButton bankAccountId={account.id} societyId={societyId} />
          {(account.powensAccountId || account.qontoAccountId) && (
            <SyncButton bankAccountId={account.id} societyId={societyId} />
          )}
          <Link href={`/banque/${id}/rapprochement`}>
            <Button variant="outline">
              <GitMerge className="h-4 w-4" />
              Rapprochement
              {account.unreconciledCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {account.unreconciledCount}
                </Badge>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Solde actuel</p>
            <p
              className={`text-2xl font-bold ${
                account.currentBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
              }`}
            >
              {account.currentBalance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-xs text-muted-foreground">Entrées</p>
            </div>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              +{credits.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Sorties</p>
            </div>
            <p className="text-xl font-bold text-destructive">
              {debits.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Non rapprochées</p>
            </div>
            <p className={`text-xl font-bold ${account.unreconciledCount > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
              {account.unreconciledCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transactions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Transactions récentes ({account.transactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {account.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune transaction enregistrée
                </p>
              ) : (
                <div className="divide-y">
                  {account.transactions.map((transaction) => {
                    const isCredit = transaction.amount >= 0;
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        {/* Icône direction */}
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          isCredit
                            ? "bg-green-100 dark:bg-green-950/40"
                            : "bg-red-50 dark:bg-red-950/30"
                        }`}>
                          {isCredit
                            ? <ArrowDownLeft className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            : <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                          }
                        </div>

                        {/* Libellé + méta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={transaction.label}>
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
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                                {transaction.category}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Montant */}
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold tabular-nums ${
                            isCredit
                              ? "text-green-600 dark:text-green-400"
                              : "text-destructive"
                          }`}>
                            {isCredit ? "+" : ""}{transaction.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </p>
                        </div>

                        {/* Statut */}
                        <div className="shrink-0 w-6 flex justify-center" title={transaction.isReconciled ? "Rapproché" : "En attente"}>
                          {transaction.isReconciled
                            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                            : <Clock className="h-4 w-4 text-muted-foreground/40" />
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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

          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Banque</p>
                <p className="text-sm font-medium">{account.bankName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IBAN (masqué)</p>
                <p className="text-sm font-mono">{account.ibanMasked}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Solde initial</p>
                <p className="text-sm">
                  {account.initialBalance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                </p>
              </div>
              {(account.powensAccountId || account.qontoAccountId) && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {account.qontoAccountId ? "Qonto" : "Open Banking"}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Synchronisation automatique active
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
