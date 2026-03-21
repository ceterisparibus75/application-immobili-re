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
import { Building2, Home, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { BuildingType } from "@prisma/client";

export const metadata = { title: "Immeubles" };

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  BUREAU: "Bureau",
  COMMERCE: "Commerce",
  MIXTE: "Mixte",
  ENTREPOT: "Entrepôt",
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
          <p className="text-muted-foreground">
            Gérez votre patrimoine immobilier
          </p>
        </div>
        <Link href={`/patrimoine/immeubles/nouveau`}>
          <Button>
            <Plus className="h-4 w-4" />
            Nouvel immeuble
          </Button>
        </Link>
      </div>

      {buildings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun immeuble</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Ajoutez votre premier immeuble pour commencer à gérer vos lots et
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
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base leading-snug">
                      {building.name}
                    </CardTitle>
                    <Badge variant="outline">
                      {BUILDING_TYPE_LABELS[building.buildingType]}
                    </Badge>
                  </div>
                  <CardDescription>
                    {building.addressLine1}
                    <br />
                    {building.postalCode} {building.city}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" />
                      {building._count.lots} lot
                      {building._count.lots !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5" />
                      {building._count.maintenances} intervention
                      {building._count.maintenances !== 1 ? "s" : ""}
                    </span>
                    {building.totalArea && (
                      <span>{building.totalArea} m²</span>
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
