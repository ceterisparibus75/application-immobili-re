import { getCharges } from "@/actions/charge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Euro, Plus, Receipt, BookOpen, FileBarChart2 } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import type { ChargeNature } from "@/generated/prisma/client";

export const metadata = { title: "Charges" };

const NATURE_LABELS: Record<ChargeNature, string> = {
  PROPRIETAIRE: "Propriétaire",
  RECUPERABLE: "Récupérable",
  MIXTE: "Mixte",
};
const NATURE_VARIANTS: Record<ChargeNature, "default" | "secondary" | "warning"> = {
  PROPRIETAIRE: "secondary",
  RECUPERABLE: "default",
  MIXTE: "warning",
};

export default async function ChargesPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const charges = await getCharges(societyId);

  const totalAmount = charges.reduce((s, c) => s + c.amount, 0);
  const totalRecuperable = charges
    .filter((c) => c.category.nature === "RECUPERABLE" || c.category.nature === "MIXTE")
    .reduce((s, c) => {
      const rate = c.category.nature === "RECUPERABLE" ? 1 : (c.category.recoverableRate ?? 50) / 100;
      return s + c.amount * rate;
    }, 0);
  const totalProprio = totalAmount - totalRecuperable;
  const unpaidCount = charges.filter((c) => !c.isPaid).length;

  const byBuilding = charges.reduce(
    (acc, charge) => {
      const key = charge.building.id;
      if (!acc[key]) acc[key] = { building: charge.building, charges: [] };
      acc[key]!.charges.push(charge);
      return acc;
    },
    {} as Record<string, { building: { id: string; name: string; city: string }; charges: typeof charges }>
  );

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Charges</h1>
          <p className="text-muted-foreground">{charges.length} charge{charges.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/charges/bibliotheque">
            <Button variant="outline" size="sm"><BookOpen className="h-4 w-4" />Bibliothèque</Button>
          </Link>
          <Link href="/charges/comptes-rendus">
            <Button variant="outline" size="sm"><FileBarChart2 className="h-4 w-4" />Comptes rendus</Button>
          </Link>
          <Link href="/charges/nouvelle">
            <Button><Plus className="h-4 w-4" />Nouvelle charge</Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total charges</p>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-muted-foreground">{charges.length} entrée{charges.length > 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Part récupérable</p>
            </div>
            <p className="text-xl font-bold text-primary">{formatCurrency(totalRecuperable)}</p>
            <p className="text-xs text-muted-foreground">Refacturable aux locataires</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Part propriétaire</p>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalProprio)}</p>
            <p className="text-xs text-muted-foreground">Non récupérable</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Non réglées</p>
            </div>
            <p className="text-xl font-bold text-destructive">{unpaidCount}</p>
            <p className="text-xs text-muted-foreground">sur {charges.length} charge{charges.length > 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
      </div>

      {charges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune charge</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Enregistrez les charges d&apos;exploitation de vos immeubles.
            </p>
            <div className="flex gap-3">
              <Link href="/charges/bibliotheque/nouvelle">
                <Button variant="outline"><BookOpen className="h-4 w-4" />Créer la bibliothèque</Button>
              </Link>
              <Link href="/charges/nouvelle">
                <Button><Plus className="h-4 w-4" />Nouvelle charge</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.values(byBuilding).map(({ building, charges: bCharges }) => {
            const bTotal = bCharges.reduce((s, c) => s + c.amount, 0);
            const bRecup = bCharges
              .filter((c) => c.category.nature !== "PROPRIETAIRE")
              .reduce((s, c) => {
                const rate = c.category.nature === "RECUPERABLE" ? 1 : (c.category.recoverableRate ?? 50) / 100;
                return s + c.amount * rate;
              }, 0);
            return (
              <Card key={building.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {building.name}{" "}
                      <span className="font-normal text-muted-foreground text-sm">— {building.city}</span>
                    </CardTitle>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{formatCurrency(bTotal)}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(bRecup)} récupérable</p>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <div className="divide-y">
                    {bCharges.map((charge) => (
                      <Link
                        key={charge.id}
                        href={`/charges/${charge.id}`}
                        className="flex items-center justify-between py-3 hover:bg-accent/50 rounded-md px-2 -mx-2 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{charge.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {charge.category.name} · {new Date(charge.date).toLocaleDateString("fr-FR")}
                            {charge.supplierName && ` · ${charge.supplierName}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(charge.amount)}</span>
                          <Badge variant={NATURE_VARIANTS[charge.category.nature]}>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
