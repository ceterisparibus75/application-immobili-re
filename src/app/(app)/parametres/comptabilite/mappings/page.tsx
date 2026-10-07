import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listMappings } from "@/actions/accounting-category-mapping";
import { ALL_CATEGORIES } from "@/lib/cashflow-categories";

import { MappingManager } from "./_components/mapping-manager";

export const metadata = { title: "Mappings comptables" };
export const dynamic = "force-dynamic";

export default async function ComptabiliteMappingsPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const res = await listMappings(societyId);
  const mappings = res.success && res.data ? res.data : [];

  const cashflowCategories = ALL_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mappings comptables</h1>
        <p className="text-muted-foreground">
          Personnalisez le compte PCG utilisé pour chaque catégorie de charge
          ou mot-clé rencontré sur les transactions bancaires.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catégorie → compte PCG</CardTitle>
          <CardDescription>
            Deux formes de mapping possibles : par catégorie cashflow
            (ex. « Énergie & fluides » → 606100) ou par mot-clé libre matché
            sur le nom de la catégorie de charge (ex. mot-clé «&nbsp;ASCENSEUR&nbsp;»
            → 615200). Si aucun mapping ne matche, le code hard-codé historique
            est utilisé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MappingManager
            societyId={societyId}
            initialMappings={mappings}
            cashflowCategories={cashflowCategories}
          />
        </CardContent>
      </Card>
    </div>
  );
}
