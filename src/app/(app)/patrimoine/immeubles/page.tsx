import { getBuildings } from "@/actions/building";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Home, MapPin, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { BuildingType } from "@/generated/prisma/client";

export const metadata = { title: "Immeubles" };

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  BUREAU: "Bureau",
  COMMERCE: "Commerce",
  MIXTE: "Mixte",
  ENTREPOT: "Entrepot",
};

export default async function ImmeublesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) {
    redirect("/societes");
  }

  const buildings = await getBuildings(societyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Immeubles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {buildings.length} immeuble{buildings.length !== 1 ? "s" : ""} dans votre patrimoine
          </p>
        </div>
        <Link href="/patrimoine/immeubles/nouveau">
          <Button>
            <Plus className="h-4 w-4" />
            Nouvel immeuble
          </Button>
        </Link>
      </div>

      {buildings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 mb-4">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucun immeuble</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-5">
              Ajoutez votre premier immeuble pour commencer a gerer vos lots et
              baux commerciaux.
            </p>
            <Link href="/patrimoine/immeubles/nouveau">
              <Button>
                <Plus className="h-4 w-4" />
                Ajouter un immeuble
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buildings.map((building) => (
            <Link
              key={building.id}
              href={`/patrimoine/immeubles/${building.id}`}
            >
              <Card className="group hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 group-hover:bg-primary/12 transition-colors">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-base leading-snug">
                        {building.name}
                      </CardTitle>
                    </div>
                    <Badge variant="outline">
                      {BUILDING_TYPE_LABELS[building.buildingType]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {building.addressLine1}, {building.postalCode} {building.city}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/50">
                    <span className="flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5" />
                      {building._count.lots} lot{building._count.lots !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      {building._count.maintenances} intervention{building._count.maintenances !== 1 ? "s" : ""}
                    </span>
                    {building.totalArea && (
                      <span className="ml-auto font-medium">{building.totalArea} m²</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
