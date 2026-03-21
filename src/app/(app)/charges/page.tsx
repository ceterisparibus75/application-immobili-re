import { getCharges } from "@/actions/charge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Euro, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ChargeNature } from "@prisma/client";

export const metadata = { title: "Charges" };

const NATURE_LABELS: Record<ChargeNature, string> = {
  PROPRIETAIRE: "Propriétaire",
  RECUPERABLE: "Récupérable",
  MIXTE: "Mixte",
};

const NATURE_VARIANTS: Record<
  ChargeNature,
  "default" | "secondary" | "warning"
> = {
  PROPRIETAIRE: "secondary",
  RECUPERABLE: "default",
  MIXTE: "warning",
};

export default async function ChargesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const charges = await getCharges(societyId);

  const totalAmount = charges.reduce((sum, c) => sum + c.amount, 0);
  const unpaid = charges.filter((c) => !c.isPaid);
  const totalUnpaid = unpaid.reduce((sum, c) => sum + c.amount, 0);

  // Grouper par immeuble
  const byBuilding = charges.reduce(
    (acc, charge) => {
      const key = charge.building.id;
      if (!acc[key]) {
        acc[key] = { building: charge.building, charges: [] };
      }
      acc[key]!.charges.push(charge);
      return acc;
    },
    {} as Record<
      string,
      {
        building: { id: string; name: string; city: string };
        charges: typeof charges;
      }
    >
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Charges</h1>
          <p className="text-muted-foreground">
            {charges.length} charge{charges.length !== 1 ? "s" : ""} —{" "}
            {totalAmount.toLocaleString("fr-FR")} € total
          </p>
        </div>
        <Link href="/charges/nouvelle">
          <Button>
            <Plus className="h-4 w-4" />
            Nouvelle charge
          </Button>
        </Link>
      </div>

      {/* Résumé */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Euro className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {totalAmount.toLocaleString("fr-FR")} €
                </p>
                <p className="text-xs text-muted-foreground">Total charges</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Receipt className="h-8 w-8 text-destructive/70" />
              <div>
                <p className="text-2xl font-bold text-destructive">
                  {totalUnpaid.toLocaleString("fr-FR")} €
                </p>
                <p className="text-xs text-muted-foreground">
                  Non réglées ({unpaid.length})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Euro className="h-8 w-8 text-green-600/70" />
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {(totalAmount - totalUnpaid).toLocaleString("fr-FR")} €
                </p>
                <p className="text-xs text-muted-foreground">
                  Réglées ({charges.length - unpaid.length})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {charges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune charge</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Enregistrez vos charges d&apos;immeuble (entretien, eau, électricité...).
            </p>
            <Link href="/charges/nouvelle">
              <Button>
                <Plus className="h-4 w-4" />
                Nouvelle charge
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.values(byBuilding).map(({ building, charges: buildingCharges }) => (
            <Card key={building.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {building.name}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      — {building.city}
                    </span>
                  </span>
                  <span className="text-sm font-normal">
                    {buildingCharges
                      .reduce((s, c) => s + c.amount, 0)
                      .toLocaleString("fr-FR")}{" "}
                    €
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {buildingCharges.map((charge) => (
                    <Link
                      key={charge.id}
                      href={`/charges/${charge.id}`}
                      className="flex items-center justify-between py-3 hover:bg-accent/50 rounded-md px-2 -mx-2 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{charge.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {charge.category.name} —{" "}
                          {new Date(charge.date).toLocaleDateString("fr-FR")}
                          {charge.supplierName && ` — ${charge.supplierName}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-medium">
                          {charge.amount.toLocaleString("fr-FR")} €
                        </p>
                        <Badge
                          variant={NATURE_VARIANTS[charge.category.nature]}
                        >
                          {NATURE_LABELS[charge.category.nature]}
                        </Badge>
                        <Badge variant={charge.isPaid ? "success" : "destructive"}>
                          {charge.isPaid ? "Réglée" : "Non réglée"}
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
