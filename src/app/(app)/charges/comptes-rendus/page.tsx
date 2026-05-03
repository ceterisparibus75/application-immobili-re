import { getChargeRegularizations } from "@/actions/charge";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, ArrowLeft, CalendarDays, ChevronDown } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { GenerateReportButton } from "./_components/generate-button";
import { ChargeReportsEmptyState } from "./_components/charge-reports-empty-state";
import { SendStatementButton } from "./_components/send-statement-button";
import { GenerateInvoiceButton } from "./_components/generate-invoice-button";
import { buildChargeReportPresentation } from "./_components/charge-report-presentation";
import { MissingTenantEmailBadge } from "./_components/missing-tenant-email-badge";
import { ChargeStatementPdfButton } from "./_components/charge-statement-pdf-button";
import { DeliveryProofBadge } from "./_components/delivery-proof-badge";
import { DeliveryProofPdfButton } from "./_components/delivery-proof-pdf-button";

export const metadata = { title: "Comptes rendus de charges" };

const NATURE_LABELS: Record<string, string> = {
  RECUPERABLE: "Récupérable",
  PARTIELLE: "Partielle",
  PROPRIETAIRE: "Propriétaire",
  MIXTE: "Mixte",
};

const ALLOCATION_LABELS: Record<string, string> = {
  TANTIEME: "Tantièmes",
  SURFACE: "Surface",
  NB_LOTS: "Nombre de lots",
  COMPTEUR: "Compteur",
  PERSONNALISE: "Personnalisée",
};

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
        <ChargeReportsEmptyState generateAction={<GenerateReportButton societyId={societyId} />} />
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
                      const presentation = buildChargeReportPresentation(report.details, report.periodStart, report.periodEnd);
                      const displayedCharges = presentation.allocatedCharges ?? report.totalCharges;
                      const occupancyLabel = presentation.hasPartialOccupancy && presentation.occupancyStart && presentation.occupancyEnd
                        ? `${formatDate(presentation.occupancyStart)} – ${formatDate(presentation.occupancyEnd)}`
                        : null;
                      const latestDelivery = report.deliveries[0] ?? null;
                      return (
                        <div key={report.id} className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">{tenantName}</p>
                                {presentation.hasPartialOccupancy && (
                                  <Badge variant="outline" className="gap-1 text-[11px]">
                                    <CalendarDays className="h-3 w-3" />
                                    Prorata {presentation.prorataDays ?? "—"} j
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {buildingName} · Lot {report.lease.lot.number}
                                {" · "}Exercice {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
                              </p>
                              {occupancyLabel && (
                                <p className="mt-1 text-xs text-foreground">
                                  Période d’occupation : <span className="font-medium">{occupancyLabel}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
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
                                  {report.balance >= 0 ? "Complément à encaisser" : "Avoir à rembourser"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Charges : {formatCurrency(displayedCharges)}
                                  {" · "}Provisions : {formatCurrency(report.totalProvisions)}
                                </p>
                              </div>
                              <Badge variant={report.isFinalized ? "success" : "secondary"}>
                                {report.isFinalized ? (
                                  <><CheckCircle className="h-3 w-3" /> Finalisé</>
                                ) : (
                                  <><Clock className="h-3 w-3" /> Brouillon</>
                                )}
                              </Badge>
                              {latestDelivery && <DeliveryProofBadge sentAt={latestDelivery.createdAt} />}
                              {latestDelivery && <DeliveryProofPdfButton deliveryId={latestDelivery.id} />}
                              <ChargeStatementPdfButton regularizationId={report.id} />
                              {report.isFinalized && report.lease.tenant.email && (
                                <SendStatementButton
                                  societyId={societyId}
                                  regularizationId={report.id}
                                  tenantEmail={report.lease.tenant.email}
                                />
                              )}
                              {report.isFinalized && !report.lease.tenant.email && <MissingTenantEmailBadge />}
                              {report.isFinalized && report.balance > 0 && (
                                <GenerateInvoiceButton regularizationId={report.id} />
                              )}
                            </div>
                          </div>

                          {presentation.categories.length > 0 && (
                            <details className="group mt-3 rounded-md border bg-muted/20">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span>Détail par catégorie ({presentation.categories.length})</span>
                                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                              </summary>
                              <div className="overflow-x-auto border-t bg-background">
                                <table className="w-full text-xs">
                                  <thead className="text-muted-foreground">
                                    <tr className="border-b">
                                      <th className="px-3 py-2 text-left font-medium">Catégorie</th>
                                      <th className="px-3 py-2 text-left font-medium">Nature</th>
                                      <th className="px-3 py-2 text-right font-medium">Total</th>
                                      <th className="px-3 py-2 text-right font-medium">Récupérable</th>
                                      <th className="px-3 py-2 text-right font-medium">Clé</th>
                                      <th className="px-3 py-2 text-right font-medium">Votre part</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {presentation.categories.map((category) => (
                                      <tr key={`${report.id}-${category.categoryName}`}>
                                        <td className="px-3 py-2 font-medium">{category.categoryName}</td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {NATURE_LABELS[category.nature] ?? category.nature}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(category.totalAmount)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(category.recoverableAmount)}</td>
                                        <td className="px-3 py-2 text-right text-muted-foreground">
                                          {(ALLOCATION_LABELS[category.allocationMethod] ?? category.allocationMethod)}
                                          {category.allocationRate > 0 && (
                                            <span className="tabular-nums"> · {category.allocationRate.toLocaleString("fr-FR")} %</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(category.tenantShare)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          )}
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

