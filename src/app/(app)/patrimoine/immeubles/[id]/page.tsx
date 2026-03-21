import { getBuildingById } from "@/actions/building";
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
  CalendarClock,
  CheckCircle2,
  Home,
  Pencil,
  Plus,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { BuildingType, LotStatus, LotType } from "@prisma/client";

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  BUREAU: "Bureau",
  COMMERCE: "Commerce",
  MIXTE: "Mixte",
  ENTREPOT: "Entrepôt",
};

const LOT_TYPE_LABELS: Record<LotType, string> = {
  LOCAL_COMMERCIAL: "Local commercial",
  RESERVE: "Réserve",
  PARKING: "Parking",
  CAVE: "Cave",
  TERRASSE: "Terrasse",
  BUREAU: "Bureau",
  ENTREPOT: "Entrepôt",
};

const LOT_STATUS_VARIANTS: Record<
  LotStatus,
  "success" | "secondary" | "warning" | "destructive"
> = {
  VACANT: "secondary",
  OCCUPE: "success",
  EN_TRAVAUX: "warning",
  RESERVE: "outline" as "secondary",
};

const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  VACANT: "Vacant",
  OCCUPE: "Occupé",
  EN_TRAVAUX: "En travaux",
  RESERVE: "Réservé",
};

export default async function ImmeubleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) {
    redirect("/societes");
  }

  const building = await getBuildingById(societyId, id);

  if (!building) {
    notFound();
  }

  const now = new Date();
  const expiredDiagnostics = building.diagnostics.filter(
    (d) => d.expiresAt && d.expiresAt < now
  );
  const expiringDiagnostics = building.diagnostics.filter(
    (d) =>
      d.expiresAt &&
      d.expiresAt >= now &&
      d.expiresAt < new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/patrimoine/immeubles">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {building.name}
              </h1>
              <Badge variant="outline">
                {BUILDING_TYPE_LABELS[building.buildingType]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {building.addressLine1}, {building.postalCode} {building.city}
            </p>
            {building.society && (
              <Link
                href={`/societes/${building.society.id}`}
                className="text-xs text-primary hover:underline"
              >
                {building.society.legalForm} {building.society.name}
              </Link>
            )}
          </div>
        </div>
        <Link href={`/patrimoine/immeubles/${id}/modifier`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4" />
            Modifier
          </Button>
        </Link>
      </div>

      {/* Alertes diagnostics */}
      {(expiredDiagnostics.length > 0 || expiringDiagnostics.length > 0) && (
        <div className="space-y-2">
          {expiredDiagnostics.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive"
            >
              <TriangleAlert className="h-4 w-4 shrink-0" />
              <span>
                Diagnostic <strong>{d.type}</strong> expiré depuis le{" "}
                {d.expiresAt?.toLocaleDateString("fr-FR")}
              </span>
            </div>
          ))}
          {expiringDiagnostics.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded-md bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
            >
              <CalendarClock className="h-4 w-4 shrink-0" />
              <span>
                Diagnostic <strong>{d.type}</strong> expire le{" "}
                {d.expiresAt?.toLocaleDateString("fr-FR")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Compteurs */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Lots"
          value={building._count.lots}
          icon={Home}
        />
        <StatCard
          label="Diagnostics"
          value={building._count.diagnostics}
          icon={CheckCircle2}
          alert={expiredDiagnostics.length > 0}
        />
        <StatCard
          label="Interventions"
          value={building._count.maintenances}
          icon={Wrench}
        />
      </div>

      {/* Infos immeuble */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Adresse" value={building.addressLine1} />
            {building.addressLine2 && (
              <InfoRow label="" value={building.addressLine2} />
            )}
            <InfoRow
              label="Ville"
              value={`${building.postalCode} ${building.city}`}
            />
            <Separator />
            <InfoRow
              label="Type"
              value={BUILDING_TYPE_LABELS[building.buildingType]}
            />
            <InfoRow
              label="Année de construction"
              value={building.yearBuilt?.toString()}
            />
            <InfoRow
              label="Surface totale"
              value={building.totalArea ? `${building.totalArea} m²` : null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valorisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Valeur vénale"
              value={
                building.marketValue
                  ? `${building.marketValue.toLocaleString("fr-FR")} €`
                  : null
              }
            />
            <InfoRow
              label="Valeur comptable nette"
              value={
                building.netBookValue
                  ? `${building.netBookValue.toLocaleString("fr-FR")} €`
                  : null
              }
            />
            {building.description && (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  {building.description}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lots */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lots ({building.lots.length})</CardTitle>
            <Link
              href={`/patrimoine/immeubles/${id}/lots/nouveau`}
            >
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Ajouter un lot
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {building.lots.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Home className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucun lot dans cet immeuble
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {building.lots.map((lot) => (
                <Link
                  key={lot.id}
                  href={`/patrimoine/immeubles/${id}/lots/${lot.id}`}
                  className="flex items-center justify-between py-3 hover:bg-accent/50 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">Lot {lot.number}</div>
                    <Badge variant="outline">
                      {LOT_TYPE_LABELS[lot.lotType]}
                    </Badge>
                    {lot.floor && (
                      <span className="text-xs text-muted-foreground">
                        Étage {lot.floor}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {lot.area} m²
                    </span>
                    <Badge variant={LOT_STATUS_VARIANTS[lot.status]}>
                      {LOT_STATUS_LABELS[lot.status]}
                    </Badge>
                    {lot.currentRent && (
                      <span className="text-sm font-medium">
                        {lot.currentRent.toLocaleString("fr-FR")} €/mois
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnostics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Diagnostics techniques ({building.diagnostics.length})
            </CardTitle>
            <Link href={`/patrimoine/immeubles/${id}/diagnostics/nouveau`}>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {building.diagnostics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun diagnostic enregistré
            </p>
          ) : (
            <div className="divide-y">
              {building.diagnostics.map((diag) => {
                const isExpired = diag.expiresAt && diag.expiresAt < now;
                const isExpiring =
                  !isExpired &&
                  diag.expiresAt &&
                  diag.expiresAt <
                    new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

                return (
                  <div
                    key={diag.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{diag.type}</span>
                      {diag.result && (
                        <span className="text-xs text-muted-foreground">
                          {diag.result}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        Réalisé le{" "}
                        {diag.performedAt.toLocaleDateString("fr-FR")}
                      </span>
                      {diag.expiresAt && (
                        <Badge
                          variant={
                            isExpired
                              ? "destructive"
                              : isExpiring
                              ? "warning"
                              : "success"
                          }
                        >
                          {isExpired ? "Expiré" : isExpiring ? "Expire bientôt" : "Valide"}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenances récentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Interventions récentes</CardTitle>
            <Link href={`/patrimoine/immeubles/${id}/maintenances/nouveau`}>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {building.maintenances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune intervention enregistrée
            </p>
          ) : (
            <div className="divide-y">
              {building.maintenances.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{m.title}</p>
                    {m.scheduledAt && (
                      <p className="text-xs text-muted-foreground">
                        Prévue le {m.scheduledAt.toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {m.cost && (
                      <span className="text-sm text-muted-foreground">
                        {m.cost.toLocaleString("fr-FR")} €
                      </span>
                    )}
                    <Badge variant={m.completedAt ? "success" : "secondary"}>
                      {m.completedAt ? "Terminée" : "En cours"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  alert,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`rounded-lg p-2 ${alert ? "bg-destructive/10" : "bg-primary/10"}`}
        >
          <Icon
            className={`h-5 w-5 ${alert ? "text-destructive" : "text-primary"}`}
          />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
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
