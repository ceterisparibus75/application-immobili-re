"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, Search, MapPin } from "lucide-react";
import { useState, useTransition, lazy, Suspense } from "react";
import { searchComparables } from "@/actions/valuation";
import { toast } from "sonner";

const ComparablesMap = lazy(() =>
  import("./comparables-map").then((m) => ({ default: m.ComparablesMap }))
);

interface ComparableSale {
  id: string;
  address: string;
  city: string;
  postalCode: string;
  saleDate: Date;
  salePrice: number;
  builtArea: number | null;
  pricePerSqm: number | null;
  propertyType: string;
  distanceKm: number | null;
  source: string;
}

export function ComparablesTable({
  comparables,
  valuationId,
  societyId,
  buildingLat,
  buildingLng,
  buildingName,
}: {
  comparables: ComparableSale[];
  valuationId: string;
  societyId: string;
  buildingLat?: number | null;
  buildingLng?: number | null;
  buildingName?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [radiusKm] = useState(5);
  const [periodYears, setPeriodYears] = useState(3);

  function handleSearch() {
    startTransition(async () => {
      const result = await searchComparables(societyId, valuationId, {
        radiusKm,
        periodYears,
      });
      if (result.success) {
        toast.success(`${result.data?.count ?? 0} transaction(s) trouvée(s)`);
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  // Stats
  const avgPrice = comparables.length > 0
    ? comparables.filter((c) => c.pricePerSqm).reduce((sum, c) => sum + (c.pricePerSqm ?? 0), 0) /
      comparables.filter((c) => c.pricePerSqm).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--color-brand-deep)]">Transactions comparables</h3>
      </div>

      {/* Formulaire de recherche */}
      <Card className="border-0 shadow-brand bg-white rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)]">
              <MapPin className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
            </div>
            <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Recherche DVF par commune</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Période (années)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={periodYears}
                onChange={(e) => setPeriodYears(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <Button onClick={handleSearch} disabled={isPending} className="bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-deep)] text-white">
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Rechercher
            </Button>
          </div>
        </CardContent>
      </Card>

      {comparables.length > 0 && (
        <>
          {/* KPIs comparables */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-brand">
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Transactions</p>
              <p className="text-xl font-semibold tabular-nums text-[var(--color-brand-deep)]">{comparables.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-brand">
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Prix moyen/m²</p>
              <p className="text-xl font-semibold tabular-nums text-[var(--color-brand-deep)]">
                {avgPrice > 0 ? `${Math.round(avgPrice)} €` : "—"}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-brand">
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Prix médian</p>
              <p className="text-xl font-semibold tabular-nums text-[var(--color-brand-deep)]">
                {comparables.length > 0
                  ? formatCurrency(
                      [...comparables].sort((a, b) => a.salePrice - b.salePrice)[
                        Math.floor(comparables.length / 2)
                      ].salePrice
                    )
                  : "—"}
              </p>
            </div>
          </div>

          {/* Carte */}
          <Suspense fallback={<div className="bg-white rounded-xl shadow-brand h-[350px] animate-pulse" />}>
            <ComparablesMap
              comparables={comparables.map((c) => ({
                id: c.id,
                address: c.address,
                city: c.city,
                salePrice: c.salePrice,
                pricePerSqm: c.pricePerSqm,
                builtArea: c.builtArea,
                latitude: null, // Les coords sont dans la DB, pas dans le ComparableSale model actuel
                longitude: null,
                saleDate: c.saleDate instanceof Date ? c.saleDate.toISOString() : String(c.saleDate),
              }))}
              buildingLat={buildingLat}
              buildingLng={buildingLng}
              buildingName={buildingName}
            />
          </Suspense>

          {/* Tableau */}
          <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Adresse</th>
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Ville</th>
                      <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Date</th>
                      <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Prix</th>
                      <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Surface</th>
                      <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">€/m²</th>
                      <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparables.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50/50">
                        <td className="py-2.5 px-4 max-w-48 truncate text-[var(--color-brand-deep)]">{c.address}</td>
                        <td className="py-2.5 px-4 text-[var(--color-brand-deep)]">{c.city}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[#94A3B8]">{formatDate(c.saleDate)}</td>
                        <td className="py-2.5 px-4 text-right font-medium tabular-nums text-[var(--color-brand-deep)]">{formatCurrency(c.salePrice)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[#94A3B8]">{c.builtArea ? `${c.builtArea} m²` : "—"}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-[var(--color-brand-deep)]">{c.pricePerSqm ? `${Math.round(c.pricePerSqm)} €` : "—"}</td>
                        <td className="py-2.5 px-4 text-right">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-[#94A3B8]">
                            {c.propertyType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[10px] text-[#94A3B8]">
                {comparables.length} transaction(s) — Source : DVF (Etalab)
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
