import { getBankAccountById } from "@/actions/bank";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Plus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AddTransactionForm from "./_components/add-transaction-form";

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
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/banque">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {account.accountName}
              </h1>
              <Badge variant={account.isActive ? "success" : "secondary"}>
                {account.isActive ? "Actif" : "Inactif"}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {account.bankName} — {account.ibanMasked}
            </p>
          </div>
        </div>
      </div>

      {/* Soldes */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Solde actuel</p>
            <p
              className={`text-2xl font-bold ${
                account.currentBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
              }`}
            >
              {account.currentBalance.toLocaleString("fr-FR", {
                maximumFractionDigits: 2,
              })}{" "}
              €
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
            <CardContent>
              {account.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune transaction enregistrée
                </p>
              ) : (
                <div className="divide-y">
                  {account.transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{transaction.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.transactionDate).toLocaleDateString(
                            "fr-FR"
                          )}
                          {transaction.reference && ` — ${transaction.reference}`}
                          {transaction.category && ` — ${transaction.category}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p
                          className={`text-sm font-medium tabular-nums ${
                            transaction.amount >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-destructive"
                          }`}
                        >
                          {transaction.amount >= 0 ? "+" : ""}
                          {transaction.amount.toLocaleString("fr-FR", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          €
                        </p>
                        {transaction.isReconciled && (
                          <Badge variant="success" className="text-xs">
                            Rapproché
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
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
                  {account.initialBalance.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  €
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
