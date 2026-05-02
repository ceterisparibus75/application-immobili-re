import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingDown, TrendingUp, Minus, SlidersHorizontal, ChevronRight, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { getChargeBudgetSummary } from "@/actions/charge-budget";
import { getTenantChargeDetail } from "@/actions/charge-tenant-detail";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Budget prévisionnel des charges" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ChargeBudgetPage({ searchParams }: PageProps) {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = typeof params.year === "string" ? parseInt(params.year) : currentYear;
  const buildingId = typeof params.buildingId === "string" ? params.buildingId : undefined;

  const [result, buildings, tenantDetail] = await Promise.all([
    getChargeBudgetSummary(societyId, year, buildingId),
    prisma.building.findMany({
      where: { societyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    buildingId ? getTenantChargeDetail(societyId, buildingId, year) : Promise.resolve(null),
  ]);

  const data = result.success ? result.data : null;
  const tenants = tenantDetail?.success ? tenantDetail.data : null;
  const selectedBuilding = buildingId ? buildings.find((b) => b.id === buildingId) : null;

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  function buildUrl(newYear?: number, newBuildingId?: string | null) {
    const p = new URLSearchParams();
    if (newYear !== undefined) p.set("year", String(newYear));
    if (newBuildingId) p.set("buildingId", newBuildingId);
    const qs = p.toString();
    return `/charges/budget${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/charges">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget prévisionnel des charges</h1>
          <p className="text-muted-foreground">Provisions collectées vs charges réelles par immeuble</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Exercice :</span>
          <div className="flex gap-1">
            {years.map((y) => (
              <Link key={y} href={buildUrl(y, buildingId)}>
                <Button variant={y === year ? "default" : "outline"} size="sm" className="min-w-[60px]">
                  {y}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {buildings.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Immeuble :</span>
            <div className="flex flex-wrap gap-1">
              <Link href={buildUrl(year, null)}>
                <Button variant={!buildingId ? "default" : "outline"} size="sm">Tous</Button>
              </Link>
              {buildings.map((b) => (
                <Link key={b.id} href={buildUrl(year, b.id)}>
                  <Button variant={buildingId === b.id ? "default" : "outline"} size="sm">{b.name}</Button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {!result.success && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{result.error}</div>
      )}

      {data && (
        <>
          {/* Totals summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Provisions collectées</p>
                <p className="mt-1 text-2xl font-bold">{formatCurrency(data.totals.totalProvisions)}</p>
                <p className="text-xs text-muted-foreground mt-1">Appels de charges {year}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Charges réelles</p>
                <p className="mt-1 text-2xl font-bold">{formatCurrency(data.totals.actualCharges)}</p>
                <p className="text-xs text-muted-foreground mt-1">Dépenses enregistrées {year}</p>
              </CardContent>
            </Card>
            <Card className={data.totals.balance >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <CardContent className="pt-6">
                <p className={`text-sm ${data.totals.balance >= 0 ? "text-green-700" : "text-red-700"}`}>
                  Solde prévisionnel
                </p>
                <p className={`mt-1 text-2xl font-bold ${data.totals.balance >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {data.totals.balance >= 0 ? "+" : ""}{formatCurrency(data.totals.balance)}
                </p>
                <p className={`text-xs mt-1 ${data.totals.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.totals.balance >= 0 ? "Excédent de provisions" : "Déficit de provisions"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Per building table */}
          {data.buildings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucune donnée pour cet exercice.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Détail par immeuble</CardTitle>
                <p className="text-xs text-muted-foreground">Cliquez sur un immeuble pour le détail locataires</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-3 text-left font-medium">Immeuble</th>
                        <th className="pb-3 text-right font-medium">Provisions</th>
                        <th className="pb-3 text-right font-medium">Charges réelles</th>
                        <th className="pb-3 text-right font-medium">Solde</th>
                        <th className="pb-3 text-right font-medium">Taux consommé</th>
                        <th className="pb-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.buildings.map((row) => {
                        const pct = row.totalProvisions > 0
                          ? Math.round((row.actualCharges / row.totalProvisions) * 100)
                          : null;
                        const isOver = row.balance < 0;
                        const isEven = row.balance === 0;
                        const isSelected = buildingId === row.buildingId;
                        return (
                          <tr
                            key={row.buildingId}
                            className={`transition-colors ${isSelected ? "bg-muted/50" : "hover:bg-muted/30"}`}
                          >
                            <td className="py-3 pr-4">
                              <Link
                                href={isSelected ? buildUrl(year, null) : buildUrl(year, row.buildingId)}
                                className="group flex items-center gap-1"
                              >
                                <span className="font-medium group-hover:text-primary transition-colors">{row.buildingName}</span>
                                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                              </Link>
                              <p className="text-xs text-muted-foreground">{row.buildingCity}</p>
                            </td>
                            <td className="py-3 text-right tabular-nums">{formatCurrency(row.totalProvisions)}</td>
                            <td className="py-3 text-right tabular-nums">{formatCurrency(row.actualCharges)}</td>
                            <td className="py-3 text-right tabular-nums">
                              <span className={`flex items-center justify-end gap-1 font-medium ${
                                isOver ? "text-red-600" : isEven ? "text-muted-foreground" : "text-green-600"
                              }`}>
                                {isOver ? <TrendingDown className="h-3.5 w-3.5" /> : isEven ? <Minus className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                                {row.balance >= 0 ? "+" : ""}{formatCurrency(row.balance)}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {pct !== null ? (
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-green-500"}`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs tabular-nums ${pct > 100 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                    {pct}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 pl-2">
                              <Link href={`/charges/categories?buildingId=${row.buildingId}`}>
                                <Button variant="ghost" size="icon" title="Gérer les clés de répartition">
                                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {data.buildings.length > 1 && (
                      <tfoot>
                        <tr className="border-t font-semibold">
                          <td className="pt-3">Total</td>
                          <td className="pt-3 text-right tabular-nums">{formatCurrency(data.totals.totalProvisions)}</td>
                          <td className="pt-3 text-right tabular-nums">{formatCurrency(data.totals.actualCharges)}</td>
                          <td className="pt-3 text-right tabular-nums">
                            <span className={data.totals.balance < 0 ? "text-red-600" : "text-green-600"}>
                              {data.totals.balance >= 0 ? "+" : ""}{formatCurrency(data.totals.balance)}
                            </span>
                          </td>
                          <td /><td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tenant detail (shown when a building is selected) */}
          {selectedBuilding && tenants && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">
                  Locataires — {selectedBuilding.name}
                </CardTitle>
                <Link href={`/charges/categories?buildingId=${buildingId}`}>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="h-4 w-4" />
                    Clés de répartition
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {tenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucun locataire actif pour cet exercice.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="pb-3 text-left font-medium">Locataire</th>
                          <th className="pb-3 text-left font-medium">Lot</th>
                          <th className="pb-3 text-right font-medium">Provisions</th>
                          <th className="pb-3 text-right font-medium">Charges allouées</th>
                          <th className="pb-3 text-right font-medium">Solde</th>
                          <th className="pb-3 text-center font-medium">Régularisation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tenants.map((t) => (
                          <tr key={t.leaseId} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-4 font-medium">{t.tenantName}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">Lot {t.lotNumber}</td>
                            <td className="py-2.5 text-right tabular-nums">{formatCurrency(t.totalProvisions)}</td>
                            <td className="py-2.5 text-right tabular-nums">
                              {t.hasRegularization ? formatCurrency(t.totalChargesAllocated) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2.5 text-right tabular-nums">
                              {t.hasRegularization ? (
                                <span className={`font-medium ${t.balance > 0 ? "text-red-600" : t.balance < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                                  {t.balance > 0 ? "+" : ""}{formatCurrency(t.balance)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2.5 text-center">
                              {t.hasRegularization ? (
                                <Badge variant={t.regularizationIsFinalized ? "success" : "secondary"} className="text-xs">
                                  {t.regularizationIsFinalized ? (
                                    <><CheckCircle className="h-3 w-3" /> Finalisée</>
                                  ) : (
                                    <><Clock className="h-3 w-3" /> Brouillon</>
                                  )}
                                </Badge>
                              ) : (
                                <Link href={`/charges/comptes-rendus`}>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground">
                                    Générer
                                  </Button>
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}