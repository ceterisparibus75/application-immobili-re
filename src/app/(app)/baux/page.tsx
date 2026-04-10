import { Fragment } from "react";
import { getLeases } from "@/actions/lease";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, FileText, Plus, Upload, CheckCircle2, AlertTriangle, Minus, MapPin } from "lucide-react";
import Link from "next/link";
import { ExportBaux } from "@/components/exports/export-baux";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LeaseStatus, LeaseType, LeaseDestination, TenantEntityType, PaymentFrequency } from "@/generated/prisma/client";

const FREQ_PERIOD_LABELS: Record<PaymentFrequency, string> = {
  MENSUEL: "mois",
  TRIMESTRIEL: "trimestre",
  SEMESTRIEL: "semestre",
  ANNUEL: "an",
};

export const metadata = { title: "Baux" };

const STATUS_LABELS: Record<LeaseStatus, string> = {
  EN_COURS: "En cours",
  RESILIE: "Résilié",
  RENOUVELE: "Renouvelé",
  EN_NEGOCIATION: "En négociation",
  CONTENTIEUX: "Contentieux",
};

const STATUS_VARIANTS: Record<
  LeaseStatus,
  "success" | "secondary" | "warning" | "destructive" | "default"
> = {
  EN_COURS: "success",
  RESILIE: "secondary",
  RENOUVELE: "default",
  EN_NEGOCIATION: "warning",
  CONTENTIEUX: "destructive",
};

const TYPE_LABELS: Record<LeaseType, string> = {
  HABITATION: "Habitation",
  MEUBLE: "Meublé",
  ETUDIANT: "Étudiant",
  MOBILITE: "Mobilité",
  COLOCATION: "Colocation",
  SAISONNIER: "Saisonnier",
  LOGEMENT_FONCTION: "Logement fonction",
  ANAH: "ANAH",
  CIVIL: "Civil",
  GLISSANT: "Glissant",
  SOUS_LOCATION: "Sous-location",
  COMMERCIAL_369: "3-6-9",
  DEROGATOIRE: "Dérogatoire",
  PRECAIRE: "Précaire",
  BAIL_PROFESSIONNEL: "Professionnel",
  MIXTE: "Mixte",
  EMPHYTEOTIQUE: "Emphytéotique",
  CONSTRUCTION: "Construction",
  REHABILITATION: "Réhabilitation",
  BRS: "BRS",
  RURAL: "Rural",
};

const DESTINATION_LABELS: Record<LeaseDestination, string> = {
  HABITATION: "Habitation",
  BUREAU: "Bureau",
  COMMERCE: "Commerce",
  ACTIVITE: "Activité",
  ENTREPOT: "Entrepôt",
  INDUSTRIEL: "Industriel",
  PROFESSIONNEL: "Professionnel",
  MIXTE: "Mixte",
  PARKING: "Parking",
  TERRAIN: "Terrain",
  AGRICOLE: "Agricole",
  HOTELLERIE: "Hôtellerie",
  EQUIPEMENT: "Équipement",
  AUTRE: "Autre",
};

const FREQ_MULTIPLIER: Record<string, number> = {
  MENSUEL: 1,
  TRIMESTRIEL: 3,
  SEMESTRIEL: 6,
  ANNUEL: 12,
};

function tenantName(t: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

type Lease = Awaited<ReturnType<typeof getLeases>>[number];

function getIndexationStatus(lease: Lease): { label: string; variant: "done" | "pending" | "none" } {
  if (!lease.indexType) return { label: "—", variant: "none" };

  const lastRevision = lease.rentRevisions?.[0];
  if (lastRevision) {
    const revisionDate = new Date(lastRevision.effectiveDate);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (revisionDate >= oneYearAgo) {
      return { label: "À jour", variant: "done" };
    }
  }

  return { label: "À faire", variant: "pending" };
}

interface BuildingGroup {
  buildingId: string;
  buildingName: string;
  buildingCity: string;
  leases: Lease[];
}

function groupByBuilding(leases: Lease[]): BuildingGroup[] {
  const map = new Map<string, BuildingGroup>();

  for (const lease of leases) {
    const b = lease.lot.building;
    let group = map.get(b.id);
    if (!group) {
      group = {
        buildingId: b.id,
        buildingName: b.name,
        buildingCity: `${b.postalCode} ${b.city}`,
        leases: [],
      };
      map.set(b.id, group);
    }
    group.leases.push(lease);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.buildingName.localeCompare(b.buildingName, "fr"),
  );
}

function monthlyTotal(leases: Lease[]): number {
  return leases.reduce(
    (sum, l) => sum + l.currentRentHT / (FREQ_MULTIPLIER[l.paymentFrequency] ?? 1),
    0,
  );
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function IndexBadge({ lease }: { lease: Lease }) {
  const idx = getIndexationStatus(lease);
  if (idx.variant === "none") return <Minus className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />;
  if (idx.variant === "done") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
      <CheckCircle2 className="h-3.5 w-3.5" />
      À jour
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
      <AlertTriangle className="h-3.5 w-3.5" />
      À faire
    </span>
  );
}

export default async function BauxPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const leases = await getLeases(societyId);

  const actifs = leases.filter((l) => l.status === "EN_COURS");
  const autres = leases.filter((l) => l.status !== "EN_COURS");

  const actifsGrouped = groupByBuilding(actifs);
  const autresGrouped = groupByBuilding(autres);

  const totalMensuel = monthlyTotal(actifs);

  const exportData = leases.map((l) => ({
    tenantName: tenantName(l.tenant),
    building: l.lot.building.name,
    lotNumber: l.lot.number,
    leaseType: TYPE_LABELS[l.leaseType] ?? l.leaseType,
    status: l.status,
    startDate: l.startDate.toLocaleDateString("fr-FR"),
    endDate: l.endDate ? l.endDate.toLocaleDateString("fr-FR") : "",
    currentRentHT: l.currentRentHT,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Baux</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {actifs.length} {actifs.length > 1 ? "baux actifs" : "bail actif"}
            {actifs.length > 0 && (
              <span className="ml-1.5">· {formatCurrency(totalMensuel)} &euro; HT/mois</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportBaux data={exportData} />
          <Link href="/import">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4" />
              Import PDF
            </Button>
          </Link>
          <Link href="/baux/nouveau">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nouveau bail
            </Button>
          </Link>
        </div>
      </div>

      {leases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 mb-4">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucun bail</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-5">
              Créez votre premier bail en associant un lot et un locataire.
            </p>
            <Link href="/baux/nouveau">
              <Button>
                <Plus className="h-4 w-4" />
                Créer un bail
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Baux actifs */}
          {actifsGrouped.map((group) => (
            <Card key={`building-${group.buildingId}`}>
              <CardHeader className="pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">{group.buildingName}</CardTitle>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {group.buildingCity}
                      <span className="text-muted-foreground/50 mx-1">·</span>
                      {group.leases.length} {group.leases.length > 1 ? "baux" : "bail"}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[15%]" />
                      <col className="w-[15%] hidden sm:table-column" />
                      <col className="w-[12%] hidden md:table-column" />
                      <col className="w-[13%]" />
                      <col className="w-[15%] hidden lg:table-column" />
                    </colgroup>
                    <thead>
                      <tr className="border-y bg-muted/30">
                        <th className="text-left py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Locataire / Lot</th>
                        <th className="text-right py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Loyer HT</th>
                        <th className="text-center py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Échéance</th>
                        <th className="text-center py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Type</th>
                        <th className="text-center py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
                        <th className="text-center py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Indexation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.leases.map((lease) => (
                        <tr key={lease.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="py-3 px-5">
                            <Link href={`/baux/${lease.id}`} className="block">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="font-medium truncate">{tenantName(lease.tenant)}</p>
                                {lease.isThirdPartyManaged && (
                                  <Badge variant="outline" className="text-teal-700 border-teal-300 bg-teal-50 text-[10px] px-1.5 py-0 shrink-0">
                                    Tiers
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">Lot {lease.lot.number}</span>
                                {lease.destination && (
                                  <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <span className="text-xs text-muted-foreground/70">{DESTINATION_LABELS[lease.destination as LeaseDestination] ?? lease.destination}</span>
                                  </>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-5 text-right whitespace-nowrap">
                            <Link href={`/baux/${lease.id}`} className="block">
                              <p className="font-semibold tabular-nums">
                                {formatCurrency(lease.currentRentHT)} &euro;
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                HT/{FREQ_PERIOD_LABELS[lease.paymentFrequency]}
                              </p>
                            </Link>
                          </td>
                          <td className="py-3 px-5 text-center hidden sm:table-cell">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {new Date(lease.endDate).toLocaleDateString("fr-FR")}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-center hidden md:table-cell">
                            <Badge variant="outline" className="text-[11px] font-normal">{TYPE_LABELS[lease.leaseType]}</Badge>
                          </td>
                          <td className="py-3 px-5 text-center">
                            <Badge variant={STATUS_VARIANTS[lease.status]} className="text-[11px]">{STATUS_LABELS[lease.status]}</Badge>
                          </td>
                          <td className="py-3 px-5 text-center hidden lg:table-cell">
                            <IndexBadge lease={lease} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Total */}
          {actifs.length > 0 && actifsGrouped.length > 1 && (
            <div className="flex justify-end px-1">
              <div className="text-sm text-muted-foreground">
                Total loyers mensuels : <span className="font-semibold text-foreground tabular-nums">{formatCurrency(totalMensuel)} &euro; HT/mois</span>
              </div>
            </div>
          )}

          {/* Autres baux */}
          {autres.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground font-medium">
                  Baux terminés / autres ({autres.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {autresGrouped.map((group) => (
                        <Fragment key={`building-other-${group.buildingId}`}>
                          <tr className="bg-muted/20">
                            <td colSpan={4} className="py-2 px-5">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                                <span className="text-xs font-medium text-muted-foreground">{group.buildingName}</span>
                                <span className="text-[11px] text-muted-foreground/60">{group.buildingCity}</span>
                              </div>
                            </td>
                          </tr>
                          {group.leases.map((lease) => (
                            <tr key={lease.id} className="hover:bg-muted/20 transition-colors opacity-50 hover:opacity-75">
                              <td className="py-2.5 px-5 pl-10">
                                <Link href={`/baux/${lease.id}`} className="block">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{tenantName(lease.tenant)}</p>
                                    {lease.isThirdPartyManaged && (
                                      <Badge variant="outline" className="text-teal-700 border-teal-300 bg-teal-50 text-[10px] px-1.5 py-0">
                                        Tiers
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Lot {lease.lot.number}
                                    {lease.destination && (
                                      <>
                                        <span className="mx-1 text-muted-foreground/30">·</span>
                                        <span className="text-muted-foreground/70">{DESTINATION_LABELS[lease.destination as LeaseDestination] ?? lease.destination}</span>
                                      </>
                                    )}
                                  </p>
                                </Link>
                              </td>
                              <td className="py-2.5 px-5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                                {formatCurrency(lease.baseRentHT)} &euro; HT/{FREQ_PERIOD_LABELS[lease.paymentFrequency]}
                              </td>
                              <td className="py-2.5 px-5 text-center hidden sm:table-cell">
                                <Badge variant="outline" className="text-[11px] font-normal">{TYPE_LABELS[lease.leaseType]}</Badge>
                              </td>
                              <td className="py-2.5 px-5 text-center">
                                <Badge variant={STATUS_VARIANTS[lease.status]} className="text-[11px]">{STATUS_LABELS[lease.status]}</Badge>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
