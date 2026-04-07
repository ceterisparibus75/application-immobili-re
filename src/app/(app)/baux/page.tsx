import { Fragment } from "react";
import { getFilteredLeases } from "@/actions/lease";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, FileText, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LeaseStatus, LeaseType, TenantEntityType, PaymentFrequency } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { BauxFilters } from "./_components/baux-filters";

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
  AUTORISATION_OCCUPATION_TEMPORAIRE: "AOT",
  CONVENTION_OCCUPATION_PRECAIRE: "COP",
  CONVENTION_OCCUPATION_TEMPORAIRE: "COT",
  BAIL_METAYAGE: "Métayage",
  CONVENTION_COLIVING: "Coliving",
  CONVENTION_MISE_A_DISPOSITION: "CMD",
  BAIL_GLISSANT: "Glissant",
  BAIL_LOI_48: "Loi 48",
  LOCATION_PARKING: "Parking",
  LOCATION_STOCKAGE: "Stockage",
  DROIT_DE_PASSAGE: "Passage",
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

type Lease = Awaited<ReturnType<typeof getFilteredLeases>>[number];

interface BuildingGroup {
  buildingId: string;
  buildingName: string;
  buildingAddress: string;
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
        buildingAddress: `${b.addressLine1} - ${b.postalCode} ${b.city}`,
        leases: [],
      };
      map.set(b.id, group);
    }
    group.leases.push(lease);
  }

  // Sort buildings alphabetically by name
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

export default async function BauxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const params = await searchParams;
  const statusFilter = typeof params.filter_status === "string" ? params.filter_status : undefined;
  const leaseTypeFilter = typeof params.filter_leaseType === "string" ? params.filter_leaseType : undefined;
  const buildingFilter = typeof params.filter_buildingId === "string" ? params.filter_buildingId : undefined;
  const proprietaireFilter = typeof params.filter_proprietaireId === "string" ? params.filter_proprietaireId : undefined;

  const [leases, buildings, proprietaires] = await Promise.all([
    getFilteredLeases(societyId, {
      status: statusFilter,
      leaseType: leaseTypeFilter,
      buildingId: buildingFilter,
      proprietaireId: proprietaireFilter,
    }),
    prisma.building.findMany({
      where: { societyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.proprietaire.findMany({
      where: { societies: { some: { id: societyId } } },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
  ]);

  const actifs = leases.filter((l) => l.status === "EN_COURS");
  const autres = leases.filter((l) => l.status !== "EN_COURS");

  const actifsGrouped = groupByBuilding(actifs);
  const autresGrouped = groupByBuilding(autres);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Baux</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {actifs.length} {actifs.length > 1 ? "baux actifs" : "bail actif"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BauxFilters buildings={buildings} proprietaires={proprietaires} />
          <Link href="/import">
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Import bail PDF
            </Button>
          </Link>
          <Link href="/baux/nouveau">
            <Button>
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
              Créez votre premier bail en associant un lot et un
              locataire.
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Baux actifs ({actifs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {actifs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun bail actif
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2 px-4 font-medium text-muted-foreground">Locataire</th>
                        <th className="text-center py-2 px-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-center py-2 px-4 font-medium text-muted-foreground">Statut</th>
                        <th className="text-center py-2 px-4 font-medium text-muted-foreground">Durée restante</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Loyer HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actifsGrouped.map((group) => (
                        <Fragment key={`building-${group.buildingId}`}>
                          {/* Building group header */}
                          <tr className="bg-muted/20">
                            <td colSpan={5} className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-semibold text-foreground">{group.buildingName}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {group.buildingAddress}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({group.leases.length} {group.leases.length > 1 ? "baux" : "bail"})
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {/* Leases in this building */}
                          {group.leases.map((lease) => {
                            const now = new Date();
                            const end = new Date(lease.endDate);
                            const diffMs = end.getTime() - now.getTime();
                            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                            const diffMonths = Math.floor(diffDays / 30.44);
                            const years = Math.floor(diffMonths / 12);
                            const months = diffMonths % 12;
                            let remainingLabel: string;
                            if (diffDays <= 0) {
                              remainingLabel = "Expiré";
                            } else if (years > 0) {
                              remainingLabel = months > 0 ? `${years} an${years > 1 ? "s" : ""} ${months} mois` : `${years} an${years > 1 ? "s" : ""}`;
                            } else {
                              remainingLabel = `${diffMonths} mois`;
                            }
                            const isExpiringSoon = diffDays > 0 && diffDays <= 90;
                            return (
                            <tr key={lease.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-4 pl-10">
                                <Link href={`/baux/${lease.id}`} className="block">
                                  <p className="font-medium">{tenantName(lease.tenant)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Lot {lease.lot.number}
                                  </p>
                                </Link>
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <Badge variant="outline">{TYPE_LABELS[lease.leaseType]}</Badge>
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <Badge variant={STATUS_VARIANTS[lease.status]}>{STATUS_LABELS[lease.status]}</Badge>
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <span className={`text-sm tabular-nums ${diffDays <= 0 ? "text-destructive font-medium" : isExpiringSoon ? "text-[var(--color-status-caution)] font-medium" : "text-muted-foreground"}`}>
                                  {remainingLabel}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <Link href={`/baux/${lease.id}`} className="block">
                                  <p className="font-medium tabular-nums">
                                    {lease.currentRentHT.toLocaleString("fr-FR")} &euro; HT/{FREQ_PERIOD_LABELS[lease.paymentFrequency]}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Depuis le {new Date(lease.startDate).toLocaleDateString("fr-FR")}
                                  </p>
                                </Link>
                              </td>
                            </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40 font-semibold">
                        <td colSpan={4} className="py-2.5 px-4 text-muted-foreground">Total loyers mensuels</td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {monthlyTotal(actifs).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&euro; HT/mois
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Autres baux */}
          {autres.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Baux terminés / autres ({autres.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {autresGrouped.map((group) => (
                      <Fragment key={`building-other-${group.buildingId}`}>
                        {/* Building group header */}
                        <tr className="bg-muted/20">
                          <td colSpan={3} className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-semibold text-muted-foreground">{group.buildingName}</span>
                              <span className="text-xs text-muted-foreground">
                                {group.buildingAddress}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {/* Leases in this building */}
                        {group.leases.map((lease) => (
                          <tr key={lease.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors opacity-60">
                            <td className="py-2.5 px-4 pl-10">
                              <Link href={`/baux/${lease.id}`} className="block">
                                <p className="font-medium">{tenantName(lease.tenant)}</p>
                                <p className="text-xs text-muted-foreground">
                                  Lot {lease.lot.number}
                                </p>
                              </Link>
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                              {lease.baseRentHT.toLocaleString("fr-FR")} &euro; HT/{FREQ_PERIOD_LABELS[lease.paymentFrequency]}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <Badge variant={STATUS_VARIANTS[lease.status]}>{STATUS_LABELS[lease.status]}</Badge>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
