import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BeneficiaryLine, LotRevenueBreakdown } from "@/lib/lot-revenue-breakdown";
import { Coins } from "lucide-react";

const ROLE_LABEL: Record<BeneficiaryLine["role"], string> = {
  PLEIN_PROPRIETAIRE: "Plein propriétaire",
  USUFRUITIER: "Usufruitier",
  NU_PROPRIETAIRE: "Nu-propriétaire",
};

const ROLE_VARIANT: Record<
  BeneficiaryLine["role"],
  "default" | "secondary" | "outline"
> = {
  PLEIN_PROPRIETAIRE: "default",
  USUFRUITIER: "secondary",
  NU_PROPRIETAIRE: "outline",
};

function fmt(amount: number): string {
  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function LotRevenueBreakdownCard({
  breakdown,
  year,
}: {
  breakdown: LotRevenueBreakdown;
  year: number;
}) {
  if (!breakdown.hasOwnershipData) return null;
  if (breakdown.byBeneficiary.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Loyers {year} — Ventilation par bénéficiaire
          </span>
          {breakdown.isDismembered && (
            <Badge variant="outline" className="text-xs font-normal">
              Lot démembré
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-normal">Bénéficiaire</th>
                <th className="pb-2 font-normal">Rôle</th>
                <th className="pb-2 font-normal text-right">Quittancé</th>
                <th className="pb-2 font-normal text-right">Encaissé</th>
                <th className="pb-2 font-normal text-right">Restant dû</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.byBeneficiary.map((line) => (
                <tr key={line.proprietaireId} className="border-b last:border-b-0">
                  <td className="py-2 font-medium">{line.proprietaireLabel}</td>
                  <td className="py-2">
                    <Badge variant={ROLE_VARIANT[line.role]} className="text-xs">
                      {ROLE_LABEL[line.role]}
                    </Badge>
                  </td>
                  <td className="py-2 text-right">{fmt(line.quittance)}</td>
                  <td className="py-2 text-right text-foreground">{fmt(line.encaisse)}</td>
                  <td className="py-2 text-right">
                    {line.outstanding > 0 ? (
                      <span className="text-destructive">{fmt(line.outstanding)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td colSpan={2} className="pt-3">
                  Total
                </td>
                <td className="pt-3 text-right">{fmt(breakdown.totals.quittance)}</td>
                <td className="pt-3 text-right">{fmt(breakdown.totals.encaisse)}</td>
                <td className="pt-3 text-right">
                  {breakdown.totals.outstanding > 0
                    ? fmt(breakdown.totals.outstanding)
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Allocation calculée à la date de chaque flux. En cas de démembrement,
          les loyers reviennent à l&apos;usufruitier (art. 578 du Code civil).
        </p>
      </CardContent>
    </Card>
  );
}
