import { getBuildings } from "@/actions/building";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { BuildingsViewToggle, type BuildingSummary } from "./_components/buildings-view-toggle";

export const metadata = { title: "Immeubles" };

const FREQ_MULT: Record<string, number> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };

export default async function ImmeublesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const buildings = await getBuildings(societyId);

  // KPIs globaux
  const totalLots = buildings.reduce((s, b) => s + b.lots.length, 0);
  const occupiedLots = buildings.reduce((s, b) => s + b.lots.filter((l) => l.status === "OCCUPE").length, 0);
  const globalOccupancy = totalLots > 0 ? Math.round((occupiedLots / totalLots) * 100) : 0;
  const totalAnnualRent = buildings.reduce((s, b) => {
    return s + b.lots.reduce((ls, lot) => {
      const lease = lot.leases[0];
      if (!lease) return ls;
      return ls + lease.currentRentHT * (FREQ_MULT[lease.paymentFrequency] ?? 12);
    }, 0);
  }, 0);
  const totalCostAll = buildings.reduce((s, b) => s + (b.totalCost ?? 0), 0);
  const totalVenalValue = buildings.reduce((s, b) => s + (b.propertyValuations?.[0]?.estimatedValueMid ?? 0), 0);

  // Sérialiser pour le composant client
  const cutoff90d = new Date();
  cutoff90d.setDate(cutoff90d.getDate() + 90);

  const buildingSummaries: BuildingSummary[] = buildings.map((building) => {
    const occupied = building.lots.filter((l) => l.status === "OCCUPE").length;
    const total = building.lots.length;
    const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
    const venalValue = building.propertyValuations?.[0]?.estimatedValueMid ?? null;
    const cost = building.totalCost;
    const variation = (cost > 0 && venalValue) ? Math.round(((venalValue - cost) / cost) * 1000) / 10 : null;
    const rendement = building.yieldRate !== null ? Math.round(building.yieldRate * 10) / 10 : null;
    const totalArea = building.totalArea ?? building.lots.reduce((s, l) => s + (l.area ?? 0), 0);
    const expiringLeases = building.lots
      .filter((lot) => {
        const lease = lot.leases[0];
        return lease && lease.endDate && new Date(lease.endDate) <= cutoff90d;
      })
      .map((lot) => ({
        lotName: `Lot ${lot.number}`,
        endDate: lot.leases[0]?.endDate
          ? new Date(lot.leases[0].endDate).toLocaleDateString("fr-FR")
          : null,
      }));

    return {
      id: building.id,
      name: building.name,
      city: building.city,
      buildingType: building.buildingType,
      totalArea,
      occupiedLots: occupied,
      totalLots: total,
      occupancyPct,
      annualRent: building.annualRent,
      cost,
      venalValue,
      variation,
      rendement,
      expiringSoon: expiringLeases.length > 0,
      expiringLeases,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Immeubles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {buildings.length} immeuble{buildings.length !== 1 ? "s" : ""} — {totalLots} lots — Occupation {globalOccupancy}%
          </p>
        </div>
        <Link href="/patrimoine/immeubles/nouveau">
          <Button><Plus className="h-4 w-4" />Nouvel immeuble</Button>
        </Link>
      </div>

      {/* KPIs synthèse */}
      {buildings.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Immeubles</p>
            <p className="text-2xl font-bold tabular-nums">{buildings.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Occupation</p>
            <p className="text-2xl font-bold tabular-nums">{occupiedLots}/{totalLots} <span className="text-base font-medium text-muted-foreground">({globalOccupancy}%)</span></p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Revenus annuels HT</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalAnnualRent)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Coût complet patrimoine</p>
            <p className="text-2xl font-bold tabular-nums">{totalCostAll > 0 ? formatCurrency(totalCostAll) : "—"}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Valeur vénale totale</p>
            <p className="text-2xl font-bold tabular-nums">{totalVenalValue > 0 ? formatCurrency(totalVenalValue) : "—"}</p>
          </div>
        </div>
      )}

      {buildings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center mb-5">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucun immeuble</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Ajoutez votre premier immeuble pour commencer à gérer vos lots et baux locatifs.
            </p>
            <Link href="/patrimoine/immeubles/nouveau">
              <Button><Plus className="h-4 w-4" />Ajouter un immeuble</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <BuildingsViewToggle buildings={buildingSummaries} />
      )}
    </div>
  );
}
