import { getBuildings } from "@/actions/building";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Home, MapPin, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { BuildingType } from "@/generated/prisma/client";

export const metadata = { title: "Immeubles" };

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  BUREAU: "Bureau", COMMERCE: "Commerce", MIXTE: "Mixte", ENTREPOT: "Entrepot",
};

export default async function ImmeublesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const buildings = await getBuildings(societyId);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Immeubles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {buildings.length} immeuble{buildings.length !== 1 ? "s" : ""} dans votre patrimoine
          </p>
        </div>
        <Link href="/patrimoine/immeubles/nouveau">
          <Button><Plus className="h-4 w-4" />Nouvel immeuble</Button>
        </Link>
      </div>

      {buildings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center mb-5">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucun immeuble</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Ajoutez votre premier immeuble pour commencer a gerer vos lots et baux locatifs.
            </p>
            <Link href="/patrimoine/immeubles/nouveau">
              <Button><Plus className="h-4 w-4" />Ajouter un immeuble</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {buildings.map((building) => (
            <Link key={building.id} href={`/patrimoine/immeubles/${building.id}`}>
              <div className="group rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-[15px] leading-tight">{building.name}</p>
                      <Badge variant="outline" className="mt-1 text-[10px]">{BUILDING_TYPE_LABELS[building.buildingType]}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{building.addressLine1}, {building.postalCode} {building.city}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/40">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Home className="h-3.5 w-3.5" />
                    {building._count.lots} lot{building._count.lots !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    {building._count.maintenances} intervention{building._count.maintenances !== 1 ? "s" : ""}
                  </span>
                  {building.totalArea && (
                    <span className="ml-auto font-semibold text-foreground/70">{building.totalArea} m&sup2;</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
