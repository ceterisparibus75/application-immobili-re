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
import { Plus, Landmark, TrendingDown, CheckCircle, CalendarCheck, Clock } from "lucide-react";
import Link from "next/link";
import { buildLenderMapping } from "@/lib/utils";

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

  // Calcul fin la plus lointaine pour les emprunts en cours
  const maxRemainingMonths = enCours.reduce((max, l) => {
    const currentPeriod = l.amortizationLines[0]?.period ?? 0;
    const remaining = l.durationMonths - currentPeriod;
    return Math.max(max, remaining);
  }, 0);

  // Regrouper par preteur (normalisation des noms identiques)
  const rawLenderNames = loans.map((l) => l.lender || "Autre");
  const lenderNameMapping = buildLenderMapping(rawLenderNames);
  const lenderGroups = new Map<string, typeof loans>();
  for (const loan of loans) {
    const rawName = loan.lender || "Autre";
    const lender = lenderNameMapping.get(rawName) ?? rawName;
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

      {/* Tableau récapitulatif encours par banque */}
      {sortedLenders.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Encours par établissement</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Établissement</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Emprunts</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Capital emprunté</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Restant dû</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Remboursé</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">% remboursé</th>
                </tr>
              </thead>
              <tbody>
                {sortedLenders.map(([lender, lenderLoans]) => {
                  const gCapital = lenderLoans.reduce((s, l) => s + l.amount, 0);
                  const gRemaining = lenderLoans.reduce((s, l) => s + (l.amortizationLines[0]?.remainingBalance ?? l.amount), 0);
                  const gPaid = gCapital - gRemaining;
                  const gPct = gCapital > 0 ? Math.round((gPaid / gCapital) * 100) : 0;
                  return (
                    <tr key={lender} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2.5 px-4 font-medium">{lender}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{lenderLoans.length}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{fmt(gCapital)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-destructive font-semibold">{fmt(gRemaining)}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-green-600 dark:text-green-400">{fmt(gPaid)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: gPct + "%" }} />
                          </div>
                          <span className="tabular-nums text-xs text-muted-foreground w-8 text-right">{gPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="py-2.5 px-4">Total</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{loans.length}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{fmt(totalCapital)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-destructive">{fmt(totalRemaining)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-green-600 dark:text-green-400">{fmt(totalCapital - totalRemaining)}</td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: (totalCapital > 0 ? Math.round(((totalCapital - totalRemaining) / totalCapital) * 100) : 0) + "%" }} />
                      </div>
                      <span className="tabular-nums text-xs w-8 text-right">{totalCapital > 0 ? Math.round(((totalCapital - totalRemaining) / totalCapital) * 100) : 0}%</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

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
            const groupMonthly = lenderLoans.filter((l) => l.status === "EN_COURS").reduce((s, l) => {
              const line = l.amortizationLines[0];
              return s + (line && line.remainingBalance > 0 ? (line.totalPayment ?? 0) : 0);
            }, 0);

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
                          {groupMonthly > 0 && <> · {fmt(groupMonthly)}/mois</>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-destructive">{fmt(groupRemaining)}</p>
                      <p className="text-xs text-muted-foreground">restant / {fmt(groupCapital)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2 px-4 font-medium text-muted-foreground">Emprunt</th>
                          <th className="text-center py-2 px-4 font-medium text-muted-foreground">Avancement</th>
                          <th className="text-right py-2 px-4 font-medium text-muted-foreground">Restant dû</th>
                          <th className="text-center py-2 px-4 font-medium text-muted-foreground">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lenderLoans.map((loan) => {
                          const last = loan.amortizationLines[0];
                          const remaining = last?.remainingBalance ?? loan.amount;
                          const paid = loan.amount - remaining;
                          const progress = loan.amount > 0 ? (paid / loan.amount) * 100 : 0;
                          const statusInfo = STATUS_LABELS[loan.status];
                          const currentPeriod = last?.period ?? 0;
                          const remainingMonths = loan.durationMonths - currentPeriod;
                          const remainingYears = Math.floor(remainingMonths / 12);
                          const remainingMo = remainingMonths % 12;

                          return (
                            <tr key={loan.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-4">
                                <Link href={"/emprunts/" + loan.id} className="block">
                                  <p className="font-medium">{loan.label}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {loan.building ? loan.building.name + ", " + loan.building.city + " · " : ""}
                                    {loan.interestRate}% · {loan.durationMonths} mois
                                    {" · "}{TYPE_LABELS[loan.loanType] ?? loan.loanType}
                                  </p>
                                </Link>
                              </td>
                              <td className="py-3 px-4">
                                <div className="min-w-[140px]">
                                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all"
                                      style={{ width: Math.min(100, progress) + "%" }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                      {Math.round(progress)}%
                                    </span>
                                    {loan.status === "EN_COURS" && remainingMonths > 0 && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {remainingYears > 0
                                          ? `${remainingYears} an${remainingYears > 1 ? "s" : ""}${remainingMo > 0 ? ` ${remainingMo} m` : ""}`
                                          : `${remainingMonths} mois`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <p className="font-semibold tabular-nums">{fmt(remaining)}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">/ {fmt(loan.amount)}</p>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge variant={statusInfo?.variant ?? "outline"} className="shrink-0">
                                  {statusInfo?.label ?? loan.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
