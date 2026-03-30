import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLoans } from "@/actions/loan";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Landmark, TrendingDown, CheckCircle, CalendarCheck } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Emprunts" };

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  EN_COURS: { label: "En cours", variant: "default" },
  TERMINE: { label: "Terminé", variant: "secondary" },
  REMBOURSE_ANTICIPE: { label: "Remboursé par anticipation", variant: "outline" },
};

const TYPE_LABELS: Record<string, string> = {
  AMORTISSABLE: "Amortissable",
  IN_FINE: "In fine",
  BULLET: "Bullet",
};

export default async function EmpruntsPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const loans = await getLoans(societyId);

  const totalCapital = loans.reduce((s, l) => s + l.amount, 0);
  const totalRemaining = loans.reduce((s, l) => {
    const last = l.amortizationLines[0];
    return s + (last?.remainingBalance ?? l.amount);
  }, 0);
  const enCours = loans.filter((l) => l.status === "EN_COURS");

  const totalMonthly = enCours.reduce((s, l) => {
    const line = l.amortizationLines[0];
    return s + (line && line.remainingBalance > 0 ? (line.totalPayment ?? 0) : 0);
  }, 0);

  // Regrouper par preteur
  const lenderGroups = new Map<string, typeof loans>();
  for (const loan of loans) {
    const lender = loan.lender || "Autre";
    if (!lenderGroups.has(lender)) lenderGroups.set(lender, []);
    lenderGroups.get(lender)!.push(loan);
  }
  const sortedLenders = [...lenderGroups.entries()].sort((a, b) => {
    const remainA = a[1].reduce((s, l) => s + (l.amortizationLines[0]?.remainingBalance ?? l.amount), 0);
    const remainB = b[1].reduce((s, l) => s + (l.amortizationLines[0]?.remainingBalance ?? l.amount), 0);
    return remainB - remainA;
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emprunts</h1>
          <p className="text-muted-foreground">
            {loans.length} emprunt{loans.length !== 1 ? "s" : ""} — {enCours.length} en cours
          </p>
        </div>
        <Link href="/emprunts/nouveau">
          <Button>
            <Plus className="h-4 w-4" />
            Nouvel emprunt
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Landmark className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{fmt(totalCapital)}</p>
                <p className="text-xs text-muted-foreground">Capital total emprunté</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-destructive/70" />
              <div>
                <p className="text-2xl font-bold text-destructive">{fmt(totalRemaining)}</p>
                <p className="text-xs text-muted-foreground">Capital restant dû</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400/70" />
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{fmt(totalCapital - totalRemaining)}</p>
                <p className="text-xs text-muted-foreground">Capital remboursé</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CalendarCheck className="h-8 w-8 text-blue-600 dark:text-blue-400/70" />
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {fmt(totalMonthly)}
                </p>
                <p className="text-xs text-muted-foreground">Échéance mensuelle totale</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun emprunt</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Enregistrez vos emprunts immobiliers pour suivre les amortissements et la valeur nette de vos biens.
            </p>
            <Link href="/emprunts/nouveau">
              <Button>
                <Plus className="h-4 w-4" />
                Nouvel emprunt
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedLenders.map(([lender, lenderLoans]) => {
            const groupRemaining = lenderLoans.reduce((s, l) => {
              const last = l.amortizationLines[0];
              return s + (last?.remainingBalance ?? l.amount);
            }, 0);
            const groupCapital = lenderLoans.reduce((s, l) => s + l.amount, 0);

            return (
              <Card key={lender}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Landmark className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base">{lender}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {lenderLoans.length} emprunt{lenderLoans.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-destructive">{fmt(groupRemaining)}</p>
                      <p className="text-xs text-muted-foreground">restant / {fmt(groupCapital)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {lenderLoans.map((loan) => {
                      const last = loan.amortizationLines[0];
                      const remaining = last?.remainingBalance ?? loan.amount;
                      const paid = loan.amount - remaining;
                      const progress = loan.amount > 0 ? (paid / loan.amount) * 100 : 0;
                      const statusInfo = STATUS_LABELS[loan.status];

                      return (
                        <Link
                          key={loan.id}
                          href={"/emprunts/" + loan.id}
                          className="flex items-center justify-between py-4 hover:bg-accent/50 rounded-md px-2 -mx-2 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium truncate">{loan.label}</p>
                              <Badge variant={statusInfo?.variant ?? "outline"} className="shrink-0">
                                {statusInfo?.label ?? loan.status}
                              </Badge>
                              <Badge variant="secondary" className="shrink-0">
                                {TYPE_LABELS[loan.loanType] ?? loan.loanType}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {loan.building ? loan.building.name + ", " + loan.building.city + " · " : ""}
                              {loan.interestRate}% · {loan.durationMonths} mois
                            </p>
                            <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: Math.min(100, progress) + "%" }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {Math.round(progress)}% remboursé
                            </p>
                          </div>
                          <div className="text-right ml-4 shrink-0">
                            <p className="text-sm font-semibold">{fmt(remaining)}</p>
                            <p className="text-xs text-muted-foreground">restant dû</p>
                            <p className="text-xs text-muted-foreground">/ {fmt(loan.amount)}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
