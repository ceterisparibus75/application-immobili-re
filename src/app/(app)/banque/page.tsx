import { getBankAccounts } from "@/actions/bank";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = { title: "Banque" };

export default async function BanquePage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const accounts = await getBankAccounts(societyId);

  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Banque</h1>
          <p className="text-muted-foreground">
            {accounts.length} compte{accounts.length !== 1 ? "s" : ""} —{" "}
            <span className={totalBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}>
              {totalBalance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
            </span>{" "}
            au total
          </p>
        </div>
        <Link href="/banque/nouveau-compte">
          <Button>
            <Plus className="h-4 w-4" />
            Nouveau compte
          </Button>
        </Link>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun compte bancaire</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Ajoutez vos comptes bancaires pour suivre vos mouvements et
              effectuer des rapprochements.
            </p>
            <Link href="/banque/nouveau-compte">
              <Button>
                <Plus className="h-4 w-4" />
                Ajouter un compte
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link key={account.id} href={`/banque/${account.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{account.accountName}</CardTitle>
                    <Badge variant={account.isActive ? "success" : "secondary"}>
                      {account.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{account.bankName}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">IBAN</p>
                      <p className="text-sm font-mono">{account.ibanMasked}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Solde actuel</p>
                      <p
                        className={`text-xl font-bold ${
                          account.currentBalance >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-destructive"
                        }`}
                      >
                        {account.currentBalance.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {account._count.transactions} transaction
                      {account._count.transactions !== 1 ? "s" : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
