import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getChargeDashboardData } from "@/actions/charge-dashboard";
import { prisma } from "@/lib/prisma";
import { MonthlyChart } from "./_components/monthly-chart";

export const metadata = { title: "Tableau de bord des charges" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ChargeDashboardPage({ searchParams }: PageProps) {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = typeof params.year === "string" ? parseInt(params.year) : currentYear;
  const buildingId = typeof params.buildingId === "string" ? params.buildingId : undefined;

  const [result, buildings] = await Promise.all([
    getChargeDashboardData(societyId, year, buildingId),
    prisma.building.findMany({
      where: { societyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const data = result.success ? result.data : null;
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  function buildUrl(newYear?: number, newBuildingId?: string | null) {
    const p = new URLSearchParams();
    if (newYear !== undefined) p.set("year", String(newYear));
    if (newBuildingId) p.set("buildingId", newBuildingId);
    const qs = p.toString();
    return `/charges/tableau-de-bord${qs ? `?${qs}` : ""}`;
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
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord des charges</h1>
          <p className="text-muted-foreground">Vue consolidée par immeuble et par mois</p>
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
          {/* KPI total */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total des charges {year}</p>
              <p className="mt-1 text-3xl font-bold">{formatCurrency(data.grandTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.buildings.length} immeuble{data.buildings.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          {/* Monthly chart */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution mensuelle {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyChart data={data.monthly} />
            </CardContent>
          </Card>

          {/* Per building */}
          {data.buildings.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.buildings.map((row) => (
                <Card key={row.buildingId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">{row.buildingName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{row.buildingCity}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(row.total)}</p>
                    {row.topCategories.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top catégories</p>
                        {row.topCategories.map((cat) => (
                          <div key={cat.name} className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{cat.name}</span>
                            <span className="text-xs font-medium tabular-nums">{formatCurrency(cat.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.buildings.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucune charge enregistrée pour cet exercice.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}