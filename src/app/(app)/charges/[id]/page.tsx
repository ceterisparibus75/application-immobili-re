import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getChargeById } from "@/actions/charge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Calendar, Tag, Pencil } from "lucide-react";
import Link from "next/link";

const NATURE_LABELS: Record<string, string> = {
  PROPRIETAIRE: "Propriétaire",
  RECUPERABLE: "Récupérable",
  MIXTE: "Mixte",
};

export default async function ChargeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) return notFound();

  const charge = await getChargeById(societyId, id);
  if (!charge) return notFound();

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/charges">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{charge.description}</h1>
          <p className="text-muted-foreground">
            {charge.building.name}, {charge.building.city}
          </p>
        </div>
        <Badge variant={charge.isPaid ? "default" : "secondary"}>
          {charge.isPaid ? "Réglée" : "Non réglée"}
        </Badge>
        <Link href={`/charges/${id}/modifier`}>
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
            Modifier
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détails</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Tag className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Catégorie</dt>
                <dd className="text-sm font-medium">{charge.category.name}</dd>
                <dd className="text-xs text-muted-foreground">
                  {NATURE_LABELS[charge.category.nature] ?? charge.category.nature}
                  {charge.category.recoverableRate != null &&
                    charge.category.nature === "MIXTE" && (
                      <> — {charge.category.recoverableRate}% récupérable</>
                    )}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Immeuble</dt>
                <dd className="text-sm font-medium">{charge.building.name}</dd>
                <dd className="text-xs text-muted-foreground">{charge.building.city}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Date de la dépense</dt>
                <dd className="text-sm font-medium">{fmtDate(charge.date)}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Période</dt>
              <dd className="text-sm font-medium">
                {fmtDate(charge.periodStart)} → {fmtDate(charge.periodEnd)}
              </dd>
            </div>
            {charge.supplierName && (
              <div>
                <dt className="text-xs text-muted-foreground">Fournisseur</dt>
                <dd className="text-sm font-medium">{charge.supplierName}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Montant total</span>
            <span className="text-2xl font-bold">{fmt(charge.amount)}</span>
          </div>
        </CardContent>
      </Card>

      {charge.invoiceUrl && (
        <Card>
          <CardContent className="pt-6">
            <a href={charge.invoiceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full">
                Voir la facture fournisseur
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
