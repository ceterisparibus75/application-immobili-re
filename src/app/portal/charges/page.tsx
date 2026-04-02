import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart2, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PortalChargesPage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

  // Trouver TOUS les locataires avec cet email (multi-soci&eacute;t&eacute;)
  const tenants = await prisma.tenant.findMany({
    where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
    select: { id: true },
  });
  const tenantIds = tenants.map((t) => t.id);

  // Trouver les baux de tous les locataires
  const leases = await prisma.lease.findMany({
    where: { tenantId: { in: tenantIds } },
    select: { id: true },
  });
  const leaseIds = leases.map((l) => l.id);

  const regularizations = await prisma.chargeRegularization.findMany({
    where: { leaseId: { in: leaseIds }, isFinalized: true },
    include: {
      lease: {
        include: {
          lot: {
            include: {
              building: { select: { name: true, addressLine1: true, city: true } },
            },
          },
          society: { select: { name: true } },
        },
      },
    },
    orderBy: [{ fiscalYear: "desc" }],
  });

  const byYear = regularizations.reduce(
    (acc, r) => {
      const y = r.fiscalYear;
      if (!acc[y]) acc[y] = [];
      acc[y]!.push(r);
      return acc;
    },
    {} as Record<number, typeof regularizations>
  );

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Charges locatives</h1>
        <p className="text-muted-foreground">Vos comptes rendus annuels de charges</p>
      </div>

      {regularizations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileBarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun compte rendu disponible</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Vos comptes rendus annuels de charges appara&icirc;tront ici d&egrave;s qu&apos;ils seront &eacute;tablis par votre
              gestionnaire.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {years.map((year) => {
            const yearReports = byYear[year]!;
            return (
              <div key={year} className="space-y-3">
                <h2 className="text-lg font-semibold">Exercice {year}</h2>
                {yearReports.map((report) => {
                  const details = report.details as Record<string, unknown> | null;
                  const categories =
                    (details?.categories as Array<{
                      categoryName: string;
                      allocationRate: number;
                      tenantShare: number;
                      recoverableAmount: number;
                    }> | undefined) ?? [];
                  const balancePositive = report.balance >= 0;
                  return (
                    <Card key={report.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{report.lease.lot.building.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Lot {report.lease.lot.number} &middot; {formatDate(report.periodStart)} &ndash;{" "}
                              {formatDate(report.periodEnd)}
                              {report.lease.society && <> &middot; {report.lease.society.name}</>}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {balancePositive ? (
                                <TrendingDown className="h-4 w-4 text-destructive" />
                              ) : (
                                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                              )}
                              <p
                                className={`text-xl font-bold ${
                                  balancePositive
                                    ? "text-destructive"
                                    : "text-green-600 dark:text-green-400"
                                }`}
                              >
                                {balancePositive ? "+" : ""}
                                {formatCurrency(report.balance)}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {balancePositive ? "Compl\u00e9ment \u00e0 payer" : "Remboursement \u00e0 venir"}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* R&eacute;sum&eacute; */}
                        <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Charges totales</p>
                            <p className="text-sm font-semibold">{formatCurrency(report.totalCharges)}</p>
                          </div>
                          <div className="text-center border-x border-border">
                            <p className="text-xs text-muted-foreground">Votre part</p>
                            <p className="text-sm font-semibold">
                              {formatCurrency((details?.totalRecoverableAllocated as number | undefined) ?? 0)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Provisions vers&eacute;es</p>
                            <p className="text-sm font-semibold">{formatCurrency(report.totalProvisions)}</p>
                          </div>
                        </div>

                        {/* D&eacute;tail par cat&eacute;gorie */}
                        {categories.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              D&eacute;tail par poste
                            </p>
                            <div className="divide-y text-sm">
                              {categories.map((cat, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5">
                                  <div>
                                    <span className="font-medium">{cat.categoryName}</span>
                                    <span className="text-muted-foreground ml-2 text-xs">
                                      ({cat.allocationRate}%)
                                    </span>
                                  </div>
                                  <span className="tabular-nums font-medium">
                                    {formatCurrency(cat.tenantShare)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Solde final */}
                        <div
                          className={`rounded-md p-3 flex items-center justify-between ${
                            balancePositive
                              ? "bg-destructive/10"
                              : "bg-green-50 dark:bg-green-950/20"
                          }`}
                        >
                          <span className="text-sm font-medium">Solde de r&eacute;gularisation</span>
                          <span
                            className={`text-sm font-bold ${
                              balancePositive
                                ? "text-destructive"
                                : "text-green-700 dark:text-green-400"
                            }`}
                          >
                            {balancePositive
                              ? `${formatCurrency(report.balance)} \u00e0 payer`
                              : `${formatCurrency(Math.abs(report.balance))} \u00e0 rembourser`}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
