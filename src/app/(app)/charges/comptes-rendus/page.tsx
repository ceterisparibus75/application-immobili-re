import { getChargeRegularizations } from "@/actions/charge";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart2, CheckCircle, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { GenerateReportButton } from "./_components/generate-button";

export const metadata = { title: "Comptes rendus de charges" };

export default async function ComptesRendusPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const reports = await getChargeRegularizations(societyId);

  // Grouper par année
  const byYear = reports.reduce(
    (acc, r) => {
      const y = r.fiscalYear;
      if (!acc[y]) acc[y] = [];
      acc[y]!.push(r);
      return acc;
    },
    {} as Record<number, typeof reports>
  );

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/charges">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Comptes rendus de charges</h1>
            <p className="text-muted-foreground">Régularisation annuelle par locataire</p>
          </div>
        </div>
        <GenerateReportButton societyId={societyId} />
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileBarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun compte rendu</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Générez les comptes rendus annuels pour chaque immeuble. Ils seront automatiquement déposés dans
              l&apos;espace de chaque locataire.
            </p>
            <GenerateReportButton societyId={societyId} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {years.map((year) => {
            const yearReports = byYear[year]!;
            const totalBalance = yearReports.reduce((s, r) => s + r.balance, 0);
            return (
              <Card key={year}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Exercice {year}
                      {year === currentYear && (
                        <Badge variant="default" className="ml-2">
                          En cours
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{formatCurrency(Math.abs(totalBalance))}</p>
                      <p className="text-xs text-muted-foreground">
                        {totalBalance >= 0 ? "à encaisser" : "à rembourser"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {yearReports.map((report) => {
                      const tenantName =
                        report.lease.tenant.entityType === "PERSONNE_MORALE"
                          ? (report.lease.tenant.companyName ?? "—")
                          : `${report.lease.tenant.firstName ?? ""} ${report.lease.tenant.lastName ?? ""}`.trim();
                      const buildingName = report.lease.lot.building.name;
                      return (
                        <div key={report.id} className="flex items-center justify-between py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{tenantName}</p>
                            <p className="text-xs text-muted-foreground">
                              {buildingName} · Lot {report.lease.lot.number}
                              {" · "}{formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <div className="text-right text-sm">
                              <p className="font-medium tabular-nums">
                                <span
                                  className={
                                    report.balance >= 0
                                      ? "text-destructive"
                                      : "text-[var(--color-status-positive)]"
                                  }
                                >
                                  {report.balance >= 0 ? "+" : ""}
                                  {formatCurrency(report.balance)}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Provisions : {formatCurrency(report.totalProvisions)}
                              </p>
                            </div>
                            <Badge variant={report.isFinalized ? "success" : "secondary"}>
                              {report.isFinalized ? (
                                <><CheckCircle className="h-3 w-3" /> Finalisé</>
                              ) : (
                                <><Clock className="h-3 w-3" /> Brouillon</>
                              )}
                            </Badge>
                          </div>
                        </div>
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
