import { getTenantsPaginated } from "@/actions/tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { ExportLocataires } from "@/components/exports/export-locataires";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parsePaginationParams } from "@/lib/pagination";
import type { RiskIndicator, TenantEntityType } from "@/generated/prisma/client";
import { TenantsDataTable } from "./_components/tenants-data-table";

export const metadata = { title: "Locataires" };

const RISK_VARIANTS: Record<RiskIndicator, "success" | "warning" | "destructive"> = {
  VERT: "success",
  ORANGE: "warning",
  ROUGE: "destructive",
};

const RISK_LABELS: Record<RiskIndicator, string> = {
  VERT: "Fiable",
  ORANGE: "Vigilance",
  ROUGE: "Risque",
};

function tenantName(tenant: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? "—")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";
}

function insuranceStatus(expiresAt: Date | null): { label: string; variant: "success" | "warning" | "destructive" | "secondary" } {
  if (!expiresAt) return { label: "Non renseignée", variant: "secondary" };
  const now = new Date();
  const daysUntil = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return { label: "Expirée", variant: "destructive" };
  if (daysUntil < 30) return { label: `Expire dans ${daysUntil}j`, variant: "warning" };
  return { label: "Valide", variant: "success" };
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LocatairesPage({ searchParams }: PageProps) {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const resolvedParams = await searchParams;
  const pagination = parsePaginationParams(resolvedParams);

  const { data: tenants, total } = await getTenantsPaginated(societyId, {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    filters: pagination.filters,
  });

  // Serialize dates for client component
  const serialized = tenants.map((t) => {
    const primaryLease = t.leases[0];
    return {
      ...t,
      name: tenantName(t),
      insurance: insuranceStatus(t.insuranceExpiresAt),
      riskVariant: RISK_VARIANTS[t.riskIndicator],
      riskLabel: RISK_LABELS[t.riskIndicator],
      totalRent: t.leases.reduce((s, l) => s + l.currentRentHT, 0),
      location: t.leases.length > 0
        ? t.leases.map((l) => `${l.lot.building.name} — Lot ${l.lot.number}`).join(", ")
        : null,
      buildingId: primaryLease?.lot.building.id ?? null,
      buildingName: primaryLease?.lot.building.name ?? null,
      buildingAddress: primaryLease
        ? `${primaryLease.lot.building.addressLine1} - ${primaryLease.lot.building.postalCode} ${primaryLease.lot.building.city}`
        : null,
    };
  });

  // Sort by building name so grouping is contiguous
  serialized.sort((a, b) => {
    if (!a.buildingName && !b.buildingName) return 0;
    if (!a.buildingName) return 1;
    if (!b.buildingName) return -1;
    return a.buildingName.localeCompare(b.buildingName, "fr");
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locataires</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} locataire{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportLocataires data={serialized} />
          <Link href="/locataires/nouveau">
            <Button>
              <Plus className="h-4 w-4" />
              Nouveau locataire
            </Button>
          </Link>
        </div>
      </div>

      {total === 0 && !pagination.search && Object.keys(pagination.filters ?? {}).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 mb-4">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucun locataire</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-5">
              Créez votre premier dossier locataire pour préparer un bail.
            </p>
            <Link href="/locataires/nouveau">
              <Button>
                <Plus className="h-4 w-4" />
                Créer un locataire
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <TenantsDataTable
          tenants={serialized}
          total={total}
          page={pagination.page}
          pageSize={pagination.pageSize}
          sortBy={pagination.sortBy}
          sortOrder={pagination.sortOrder}
          search={pagination.search}
          activeFilters={pagination.filters}
        />
      )}
    </div>
  );
}
