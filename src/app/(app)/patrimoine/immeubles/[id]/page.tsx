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
  Bot,
 
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Home,
  Pencil,
  Plus,
  TriangleAlert,
  User,
  Wrench,
} from "lucide-react";
import { BuildingDocumentUpload } from "./_components/building-document-upload";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { BuildingType, LotStatus, LotType, PaymentFrequency } from "@/generated/prisma/client";

const FREQUENCY_SHORT: Record<PaymentFrequency, string> = {
  MENSUEL: "€/mois",
  TRIMESTRIEL: "€/trim.",
  SEMESTRIEL: "€/sem.",
  ANNUEL: "€/an",
};
import { DeleteBuildingButton } from "./_components/delete-building-button";

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  BUREAU: "Bureau",
  COMMERCE: "Commerce",
  MIXTE: "Mixte",
  ENTREPOT: "Entrepôt",
};

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
      {/* Fil d'Ariane + Header */}
      <div className="space-y-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/patrimoine/immeubles" className="hover:text-foreground transition-colors">
            Immeubles
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate">{building.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{building.name}</h1>
              <Badge variant="outline">{BUILDING_TYPE_LABELS[building.buildingType]}</Badge>
            </div>
            <p className="text-muted-foreground mt-0.5">
              {building.addressLine1}, {building.postalCode} {building.city}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/patrimoine/immeubles/${id}/modifier`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
            </Link>
            <DeleteBuildingButton
              societyId={societyId}
              buildingId={id}
              buildingName={building.name}
              hasActiveLeases={building.lots.some((l) =>
                l.leases?.some((le) => le.status === "EN_COURS")
              )}
            />
          </div>
        </div>
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
            <div className="flex items-center justify-between">
              <CardTitle>Valorisation</CardTitle>
              <Link href={`/patrimoine/immeubles/${id}/valorisation`}>
                <Button variant="outline" size="sm">
                  <Bot className="h-4 w-4" />
                  Avis de valeur IA
                </Button>
              </Link>
            </div>
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
            {building.propertyValuations?.[0] && (() => {
              const v = building.propertyValuations[0];
              const expert = v.expertReports?.[0];
              if (expert) {
                return (
                  <div className="text-[11px] text-muted-foreground -mt-2">
                    Expertise {expert.expertName} du {new Date(expert.reportDate).toLocaleDateString("fr-FR")}
                  </div>
                );
              }
              return (
                <div className="text-[11px] text-muted-foreground -mt-2">
                  Estimation IA du {new Date(v.valuationDate).toLocaleDateString("fr-FR")}
                </div>
              );
            })()}
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
            <Link href={`/patrimoine/immeubles/${id}/lots/nouveau`}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Ajouter un lot
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {building.lots.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center px-6">
              <Home className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Aucun lot dans cet immeuble
              </p>
              <Link href={`/patrimoine/immeubles/${id}/lots/nouveau`}>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                  Créer le premier lot
                </Button>
              </Link>
            </div>
          ) : (
            <div>
              {/* En-tête du tableau (desktop) */}
              <div className="hidden md:grid md:grid-cols-[1fr_80px_80px_100px_150px_28px] gap-3 items-center px-4 py-2.5 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Lot</span>
                <span className="text-right">Surface</span>
                <span className="text-center">Étage</span>
                <span className="text-center">Statut</span>
                <span className="text-right">Loyer</span>
                <span />
              </div>
              {building.lots.map((lot, index) => {
                const activeLease = lot.leases[0] ?? null;
                const tenantName = activeLease?.tenant
                  ? activeLease.tenant.entityType === "PERSONNE_MORALE"
                    ? activeLease.tenant.companyName ?? ""
                    : `${activeLease.tenant.firstName ?? ""} ${activeLease.tenant.lastName ?? ""}`.trim()
                  : null;

                return (
                  <Link
                    key={lot.id}
                    href={`/patrimoine/immeubles/${id}/lots/${lot.id}`}
                    className={`block transition-colors hover:bg-accent/50 group ${index < building.lots.length - 1 ? "border-b" : ""}`}
                  >
                    {/* Desktop */}
                    <div className="hidden md:grid md:grid-cols-[1fr_80px_80px_100px_150px_28px] gap-3 items-center px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          {lot.number}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">Lot {lot.number}</span>
                            <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{LOT_TYPE_LABELS[lot.lotType]}</span>
                          </div>
                          {tenantName ? (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <User className="h-3 w-3 text-muted-foreground/60" />
                              <span className="text-xs text-muted-foreground truncate">{tenantName}</span>
                            </div>
                          ) : lot.status === "VACANT" ? (
                            <span className="text-xs text-muted-foreground/60 italic">Pas de locataire</span>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-sm tabular-nums text-right text-muted-foreground">
                        {lot.area ? `${lot.area} m²` : "—"}
                      </span>
                      <span className="text-sm tabular-nums text-center text-muted-foreground">
                        {lot.floor ? `Ét. ${lot.floor}` : "RDC"}
                      </span>
                      <div className="flex justify-center">
                        <Badge variant={LOT_STATUS_VARIANTS[lot.status]} className="text-[11px]">
                          {LOT_STATUS_LABELS[lot.status]}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-right">
                        {activeLease?.currentRentHT
                          ? `${activeLease.currentRentHT.toLocaleString("fr-FR")} ${FREQUENCY_SHORT[activeLease.paymentFrequency as PaymentFrequency] ?? "€/mois"}`
                          : <span className="text-muted-foreground font-normal">—</span>}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>

                    {/* Mobile */}
                    <div className="flex items-center justify-between px-4 py-3 md:hidden">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                          {lot.number}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">Lot {lot.number}</span>
                            <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{LOT_TYPE_LABELS[lot.lotType]}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {tenantName && <span className="truncate max-w-[150px]">{tenantName}</span>}
                            {lot.area && <span>{lot.area} m²</span>}
                            {lot.floor && <span>Ét. {lot.floor}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <div className="text-right">
                          <Badge variant={LOT_STATUS_VARIANTS[lot.status]} className="text-[11px]">
                            {LOT_STATUS_LABELS[lot.status]}
                          </Badge>
                          {activeLease?.currentRentHT && (
                            <p className="text-xs font-semibold tabular-nums mt-0.5">
                              {activeLease.currentRentHT.toLocaleString("fr-FR")} {FREQUENCY_SHORT[activeLease.paymentFrequency as PaymentFrequency] ?? "€/mois"}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    </div>
                  </Link>
                );
              })}
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
                  <div key={diag.id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{diag.type}</span>
                        {diag.result && (
                          <span className="text-xs text-muted-foreground">{diag.result}</span>
                        )}
                        {diag.aiAnalysis && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Bot className="h-3 w-3" /> Analysé par IA
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {diag.fileUrl && (
                          <a
                            href={diag.fileUrl ?? ""}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" /> PDF
                          </a>
                        )}
                        <span className="text-muted-foreground">
                          Réalisé le {diag.performedAt.toLocaleDateString("fr-FR")}
                        </span>
                        {diag.expiresAt && (
                          <Badge variant={isExpired ? "destructive" : isExpiring ? "warning" : "success"}>
                            {isExpired ? "Expiré" : isExpiring ? "Expire bientôt" : "Valide"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {diag.aiAnalysis && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-primary flex items-center gap-1 w-fit">
                          <Bot className="h-3 w-3" /> Voir l'analyse IA
                        </summary>
                        <div className="mt-2 p-3 rounded-md bg-muted/50 whitespace-pre-wrap text-muted-foreground leading-relaxed">
                          {diag.aiAnalysis}
                        </div>
                      </details>
                    )}
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

      {/* Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents ({building.documents.length})
            </CardTitle>
            <BuildingDocumentUpload buildingId={id} societyId={societyId} />
          </div>
        </CardHeader>
        <CardContent>
          {building.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun document</p>
          ) : (
            <div className="divide-y">
              {building.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{doc.description ?? doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.category && <span className="capitalize">{doc.category.replace(/_/g, " ")} — </span>}
                      {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                      {doc.expiresAt && (
                        <span className={new Date(doc.expiresAt) < new Date() ? " text-destructive font-medium" : ""}>
                          {" "}— Expire le {new Date(doc.expiresAt).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </p>
                  </div>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 text-primary hover:text-primary/80" />
                  </a>
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
