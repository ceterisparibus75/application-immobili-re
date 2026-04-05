import { getBankAccounts } from "@/actions/bank";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Landmark, Plus, Wallet } from "lucide-react";
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
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">Banque</h1>
          <p className="text-muted-foreground">
            {accounts.length} compte{accounts.length !== 1 ? "s" : ""} —{" "}
            <span className={`font-semibold ${totalBalance >= 0 ? "text-[var(--color-brand-deep)]" : "text-red-500"}`}>
              {totalBalance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
            </span>{" "}
            au total
          </p>
        </div>
        <Link href="/banque/nouveau-compte">
          <Button className="bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg gap-1.5">
            <Plus className="h-4 w-4" />
            Nouveau compte
          </Button>
        </Link>
      </div>

      {accounts.length === 0 ? (
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-brand-light)] mb-4">
              <Landmark className="h-7 w-7 text-[var(--color-brand-blue)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-2">Aucun compte bancaire</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Ajoutez vos comptes bancaires pour suivre vos mouvements et
              effectuer des rapprochements.
            </p>
            <Link href="/banque/nouveau-compte">
              <Button className="bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg gap-1.5">
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
              <Card className="border-0 shadow-brand bg-white rounded-xl hover:shadow-brand-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">{account.accountName}</CardTitle>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      account.isActive
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {account.isActive ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{account.bankName}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">IBAN</p>
                      <p className="text-sm font-mono text-[var(--color-brand-deep)]">{account.ibanMasked}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Solde actuel</p>
                      <p
                        className={`text-xl font-semibold tabular-nums ${
                          account.currentBalance >= 0
                            ? "text-[var(--color-brand-deep)]"
                            : "text-red-500"
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
