"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { searchComparables } from "@/actions/valuation";
import { toast } from "sonner";

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
}: {
  comparables: ComparableSale[];
  valuationId: string;
  societyId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [radiusKm, setRadiusKm] = useState(5);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Transactions comparables</h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recherche DVF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Rayon (km)</Label>
              <Input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label>Période (années)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={periodYears}
                onChange={(e) => setPeriodYears(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <Button onClick={handleSearch} disabled={isPending}>
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
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">Adresse</th>
                    <th className="py-2 font-medium">Ville</th>
                    <th className="py-2 font-medium text-right">Date</th>
                    <th className="py-2 font-medium text-right">Prix</th>
                    <th className="py-2 font-medium text-right">Surface</th>
                    <th className="py-2 font-medium text-right">€/m²</th>
                    <th className="py-2 font-medium text-right">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 max-w-48 truncate">{c.address}</td>
                      <td className="py-2">{c.city}</td>
                      <td className="py-2 text-right">{formatDate(c.saleDate)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(c.salePrice)}</td>
                      <td className="py-2 text-right">{c.builtArea ? `${c.builtArea} m²` : "—"}</td>
                      <td className="py-2 text-right">{c.pricePerSqm ? `${Math.round(c.pricePerSqm)} €` : "—"}</td>
                      <td className="py-2 text-right text-muted-foreground">{c.distanceKm ? `${c.distanceKm} km` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {comparables.length} transaction(s) — Source : DVF (Etalab)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
