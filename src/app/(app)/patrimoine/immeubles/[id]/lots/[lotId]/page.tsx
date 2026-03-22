import { getLotById } from "@/actions/lot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FileText,
  Home,
  Pencil,
  Plus,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LotType, LotStatus } from "@prisma/client";
import { DeleteLotButton } from "./_components/delete-lot-button";

const LOT_TYPE_LABELS: Record<LotType, string> = {
  LOCAL_COMMERCIAL: "Local commercial",
  BUREAUX: "Bureaux",
  LOCAL_ACTIVITE: "Local d'activité",
  RESERVE: "Réserve",
  PARKING: "Parking",
  CAVE: "Cave",
  TERRASSE: "Terrasse",
  ENTREPOT: "Entrepôt",
  APPARTEMENT: "Appartement",
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

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string; lotId: string }>;
}) {
  const { id, lotId } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) {
    redirect("/societes");
  }

  const lot = await getLotById(societyId, lotId);

  if (!lot) {
    notFound();
  }

  const activeLease = lot.leases[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane + Header */}
      <div className="space-y-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
          <Link href="/patrimoine/immeubles" className="hover:text-foreground transition-colors">
            Immeubles
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link href={`/patrimoine/immeubles/${id}`} className="hover:text-foreground transition-colors flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {lot.building.name}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium">Lot {lot.number}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">Lot {lot.number}</h1>
              <Badge variant="outline">{LOT_TYPE_LABELS[lot.lotType]}</Badge>
              <Badge variant={LOT_STATUS_VARIANTS[lot.status]}>
                {LOT_STATUS_LABELS[lot.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5">
              {lot.building.postalCode} {lot.building.city}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/patrimoine/immeubles/${id}/lots/${lotId}/modifier`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
            </Link>
            <DeleteLotButton
              societyId={societyId}
              buildingId={id}
              lotId={lotId}
              lotNumber={lot.number}
              leaseCount={lot._count.leases}
            />
          </div>
        </div>
      </div>

      {/* Bail actif */}
      {activeLease ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-green-700 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Bail en cours —{" "}
                  {activeLease.tenant.entityType === "PERSONNE_MORALE"
                    ? activeLease.tenant.companyName
                    : `${activeLease.tenant.firstName} ${activeLease.tenant.lastName}`}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  Depuis le{" "}
                  {new Date(activeLease.startDate).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <Link href={`/baux/${activeLease.id}`}>
              <Button size="sm" variant="outline">
                <FileText className="h-4 w-4" />
                Voir le bail
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun bail actif sur ce lot
          </p>
          <Link href={`/baux/nouveau?lotId=${lot.id}`}>
            <Button size="sm" variant="outline" className="mt-2">
              Créer un bail
            </Button>
          </Link>
        </div>
      )}

      {/* Infos lot */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Caractéristiques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Type" value={LOT_TYPE_LABELS[lot.lotType]} />
            <InfoRow label="Surface" value={`${lot.area} m²`} />
            <InfoRow
              label="Tantièmes"
              value={lot.commonShares ? `${lot.commonShares}` : null}
            />
            <InfoRow label="Étage" value={lot.floor} />
            <InfoRow label="Position" value={lot.position} />
            <Separator />
            <InfoRow label="Statut" value={LOT_STATUS_LABELS[lot.status]} />
            {lot.description && (
              <div className="text-sm text-muted-foreground pt-1">
                {lot.description}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valeur locative</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Valeur de marché"
              value={
                lot.marketRentValue
                  ? `${lot.marketRentValue.toLocaleString("fr-FR")} € HT/mois`
                  : null
              }
            />
            <InfoRow
              label="Loyer pratiqué"
              value={
                lot.currentRent
                  ? `${lot.currentRent.toLocaleString("fr-FR")} € HT/mois`
                  : null
              }
            />
            <Separator />
            <InfoRow label="Nombre de baux" value={`${lot._count.leases}`} />
            {lot.status === "VACANT" && (
              <Link href={`/baux/nouveau?lotId=${lot.id}`}>
                <Button size="sm" variant="outline" className="w-full mt-1">
                  <Plus className="h-4 w-4" />
                  Créer un bail
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between text-sm">
      {label && <span className="text-muted-foreground">{label}</span>}
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
