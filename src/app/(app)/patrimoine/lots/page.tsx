import { getLots } from "@/actions/lot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Home } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LotType, LotStatus } from "@prisma/client";

export const metadata = { title: "Lots" };

const LOT_TYPE_LABELS: Record<LotType, string> = {
  LOCAL_COMMERCIAL: "Local commercial",
  BUREAUX: "Bureaux",
  LOCAL_ACTIVITE: "Local d'activité",
  RESERVE: "Réserve",
  PARKING: "Parking",
  CAVE: "Cave",
  TERRASSE: "Terrasse",
  BUREAU: "Bureau",
  ENTREPOT: "Entrepôt",
};

const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  VACANT: "Vacant",
  OCCUPE: "Occupé",
  EN_TRAVAUX: "En travaux",
  RESERVE: "Réservé",
};

const LOT_STATUS_VARIANTS: Record<
  LotStatus,
  "success" | "secondary" | "warning" | "default"
> = {
  VACANT: "secondary",
  OCCUPE: "success",
  EN_TRAVAUX: "warning",
  RESERVE: "default",
};

export default async function LotsPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) {
    redirect("/societes");
  }

  const lots = await getLots(societyId);

  // Grouper par immeuble
  const byBuilding = lots.reduce<
    Record<string, { building: { id: string; name: string; city: string }; lots: typeof lots }>
  >((acc, lot) => {
    const bId = lot.building.id;
    if (!acc[bId]) {
      acc[bId] = { building: lot.building, lots: [] };
    }
    acc[bId]!.lots.push(lot);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lots</h1>
          <p className="text-muted-foreground">
            {lots.length} lot{lots.length !== 1 ? "s" : ""} au total
          </p>
        </div>
      </div>

      {lots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun lot</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Commencez par créer un immeuble, puis ajoutez des lots.
            </p>
            <Link href="/patrimoine/immeubles">
              <Button>Voir les immeubles</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.values(byBuilding).map(({ building, lots: buildingLots }) => (
            <Card key={building.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <Link
                      href={`/patrimoine/immeubles/${building.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {building.name}
                    </Link>
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {building.city}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {buildingLots.map((lot) => (
                    <Link
                      key={lot.id}
                      href={`/patrimoine/immeubles/${building.id}/lots/${lot.id}`}
                      className="flex items-center justify-between py-3 px-2 hover:bg-accent/50 rounded-md transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium w-16">
                          Lot {lot.number}
                        </span>
                        <Badge variant="outline">
                          {LOT_TYPE_LABELS[lot.lotType]}
                        </Badge>
                        {lot.floor && (
                          <span className="text-xs text-muted-foreground">
                            Étage {lot.floor}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {lot.area} m²
                        </span>
                        {lot.currentRent && (
                          <span className="font-medium">
                            {lot.currentRent.toLocaleString("fr-FR")} €/mois
                          </span>
                        )}
                        <Badge variant={LOT_STATUS_VARIANTS[lot.status]}>
                          {LOT_STATUS_LABELS[lot.status]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
