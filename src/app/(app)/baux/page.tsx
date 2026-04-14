import { getLeases } from "@/actions/lease";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { ExportBaux } from "@/components/exports/export-baux";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LeaseStatus, LeaseType, LeaseDestination, TenantEntityType } from "@/generated/prisma/client";
import { BauxViewToggle, type BuildingGroupSummary, type LeaseSummary } from "./_components/baux-view-toggle";

export const metadata = { title: "Baux" };

function NewLeaseMenu({ align = "end" }: { align?: "start" | "center" | "end" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Ajouter un bail
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-80">
        <DropdownMenuItem asChild>
          <Link href="/baux/nouveau/rapide" className="flex flex-col items-start gap-1">
            <span className="font-medium">Bail rapide</span>
            <span className="text-xs text-muted-foreground">
              Lot et locataire existants — renseignez les conditions et créez le bail.
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/baux/import" className="flex flex-col items-start gap-1">
            <span className="font-medium">Import depuis un PDF</span>
            <span className="text-xs text-muted-foreground">
              L&apos;IA analyse le bail signé et prérempli les données automatiquement.
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/baux/nouveau/complet" className="flex flex-col items-start gap-1">
            <span className="font-medium">Bail complet</span>
            <span className="text-xs text-muted-foreground">
              Créer immeuble, lot et locataire en même temps que le bail.
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

function toLeaseSummary(lease: Lease): LeaseSummary {
  const idx = getIndexationStatus(lease);
  return {
    id: lease.id,
    tenantName: tenantName(lease.tenant),
    lotNumbers:
      lease.leaseLots.length > 1
        ? `Lots ${lease.leaseLots.map((ll) => ll.lot.number).join(", ")}`
        : `Lot ${lease.lot.number}`,
    destination: lease.destination
      ? (DESTINATION_LABELS[lease.destination as LeaseDestination] ?? lease.destination)
      : null,
    buildingName: lease.lot.building.name,
    buildingCity: `${lease.lot.building.postalCode} ${lease.lot.building.city}`,
    currentRentHT: lease.currentRentHT,
    paymentFrequency: lease.paymentFrequency,
    startDate: lease.startDate.toISOString(),
    endDate: lease.endDate ? lease.endDate.toISOString() : lease.startDate.toISOString(),
    status: lease.status,
    statusLabel: STATUS_LABELS[lease.status],
    statusVariant: STATUS_VARIANTS[lease.status],
    leaseTypeLabel: TYPE_LABELS[lease.leaseType],
    isThirdPartyManaged: lease.isThirdPartyManaged,
    indexationStatus: idx.variant,
  };
}

function toBuildingGroupSummaries(groups: BuildingGroup[]): BuildingGroupSummary[] {
  return groups.map((g) => ({
    buildingId: g.buildingId,
    buildingName: g.buildingName,
    buildingCity: g.buildingCity,
    leases: g.leases.map(toLeaseSummary),
  }));
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

  const actifsGroupedSummary = toBuildingGroupSummaries(actifsGrouped);
  const autresGroupedSummary = toBuildingGroupSummaries(autresGrouped);

  const exportData = leases.map((l) => ({
    tenantName: tenantName(l.tenant),
    building: l.lot.building.name,
    lotNumber: l.leaseLots.length > 1
      ? l.leaseLots.map((ll) => ll.lot.number).join(" + ")
      : l.lot.number,
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
          <NewLeaseMenu />
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
            <NewLeaseMenu align="center" />
          </CardContent>
        </Card>
      ) : (
        <BauxViewToggle
          actifsGrouped={actifsGroupedSummary}
          autresGrouped={autresGroupedSummary}
          totalMensuel={totalMensuel}
        />
      )}
    </div>
  );
}
