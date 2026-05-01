import { getTenantsPaginated } from "@/actions/tenant";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import { ExportLocataires } from "@/components/exports/export-locataires";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parsePaginationParams } from "@/lib/pagination";
import type { RiskIndicator, TenantEntityType } from "@/generated/prisma/client";
import { TenantsDataTable, type TenantGroupBy, type TenantViewSort } from "./_components/tenants-data-table";
import { LocatairesEmptyState } from "./_components/locataires-empty-state";

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

function isBlank(value?: string | null) {
  return !value || value.trim().length === 0;
}

function isMissingEmail(value?: string | null) {
  return isBlank(value) || (value ?? "").toLowerCase().includes("a-renseigner");
}

function dossierCompleteness(tenant: {
  entityType: TenantEntityType;
  companyName?: string | null;
  companyLegalForm?: string | null;
  siret?: string | null;
  companyAddress?: string | null;
  legalRepName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  personalAddress?: string | null;
  autoEntrepreneurSiret?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
}) {
  const missingCritical: string[] = [];
  const missingSecondary: string[] = [];

  if (isMissingEmail(tenant.email)) missingCritical.push("Email");
  if (isBlank(tenant.phone) && isBlank(tenant.mobile)) missingSecondary.push("Téléphone");

  if (tenant.entityType === "PERSONNE_MORALE") {
    if (isBlank(tenant.companyName)) missingCritical.push("Raison sociale");
    if (isBlank(tenant.siret)) missingCritical.push("SIRET");
    if (isBlank(tenant.companyAddress)) missingCritical.push("Adresse");
    if (isBlank(tenant.companyLegalForm)) missingSecondary.push("Forme juridique");
    if (isBlank(tenant.legalRepName)) missingSecondary.push("Représentant");
  } else {
    if (isBlank(tenant.firstName)) missingCritical.push("Prénom");
    if (isBlank(tenant.lastName)) missingCritical.push("Nom");
    if (isBlank(tenant.personalAddress)) missingCritical.push("Adresse");
    if (!isBlank(tenant.autoEntrepreneurSiret) && tenant.autoEntrepreneurSiret!.replace(/\D/g, "").length < 9) {
      missingSecondary.push("SIRET AE");
    }
  }

  const missing = [...missingCritical, ...missingSecondary];
  if (missingCritical.length > 0) {
    return {
      status: "critical" as const,
      label: `${missing.length} manquant${missing.length > 1 ? "s" : ""}`,
      missing,
      variant: "destructive" as const,
    };
  }
  if (missingSecondary.length > 0) {
    return {
      status: "missing" as const,
      label: `${missing.length} à compléter`,
      missing,
      variant: "warning" as const,
    };
  }
  return {
    status: "complete" as const,
    label: "Complet",
    missing,
    variant: "success" as const,
  };
}

const TENANT_VIEW_SORTS = new Set<TenantViewSort>([
  "alpha",
  "entry-desc",
  "entry-asc",
  "building",
  "balance-desc",
  "rent-desc",
  "risk",
  "dossier",
  "last-login-desc",
]);

const TENANT_GROUPS = new Set<TenantGroupBy>(["none", "building", "risk", "dossier", "insurance"]);

function parseTenantViewSort(value: string | string[] | undefined): TenantViewSort {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && TENANT_VIEW_SORTS.has(raw as TenantViewSort) ? (raw as TenantViewSort) : "alpha";
}

function parseTenantGroupBy(value: string | string[] | undefined): TenantGroupBy {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && TENANT_GROUPS.has(raw as TenantGroupBy) ? (raw as TenantGroupBy) : "none";
}

function formatDate(value?: Date | null) {
  return value
    ? value.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
}

function daysSince(value?: Date | null) {
  if (!value) return null;
  return Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24));
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
  const viewSort = parseTenantViewSort(resolvedParams.viewSort);
  const groupBy = parseTenantGroupBy(resolvedParams.groupBy);

  const { data: tenants, total } = await getTenantsPaginated(societyId, {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.search,
    filters: pagination.filters,
  });

  // Serialize dates for client component
  const serialized = tenants.map((t) => {
    const primaryLease = t.leases[0];
    const lotLabel = t.leases.length > 0
      ? t.leases.map((l) => `Lot ${l.lot.number}`).join(", ")
      : null;

    return {
      id: t.id,
      entityType: t.entityType,
      email: t.email,
      phone: t.phone,
      mobile: t.mobile,
      _count: t._count,
      isActive: t.isActive,
      name: tenantName(t),
      dossier: dossierCompleteness(t),
      insurance: insuranceStatus(t.insuranceExpiresAt),
      riskVariant: RISK_VARIANTS[t.riskIndicator],
      riskLabel: RISK_LABELS[t.riskIndicator],
      totalRent: t.leases.reduce((s, l) => s + l.currentRentHT, 0),
      balance: t.balance,
      location: t.leases.length > 0
        ? t.leases.map((l) => `${l.lot.building.name} — Lot ${l.lot.number}`).join(", ")
        : null,
      buildingId: primaryLease?.lot.building.id ?? null,
      buildingName: primaryLease?.lot.building.name ?? null,
      buildingAddress: primaryLease
        ? `${primaryLease.lot.building.addressLine1} - ${primaryLease.lot.building.postalCode} ${primaryLease.lot.building.city}`
        : null,
      lotLabel,
      entryDate: primaryLease?.startDate.toISOString() ?? null,
      entryDateLabel: formatDate(primaryLease?.startDate ?? null),
      portal: t.portalAccess
        ? {
            isActive: t.portalAccess.isActive,
            invitedAt: t.portalAccess.invitedAt.toISOString(),
            invitedAtLabel: formatDate(t.portalAccess.invitedAt),
            lastLoginAt: t.portalAccess.lastLoginAt?.toISOString() ?? null,
            lastLoginAtLabel: formatDate(t.portalAccess.lastLoginAt ?? null),
            daysSinceLastLogin: daysSince(t.portalAccess.lastLoginAt ?? null),
            activationPending: !!t.portalAccess.activationCode,
          }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locataires</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} locataire{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportLocataires data={serialized} />
          <Link href="/import/en-masse?type=tenants">
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href="/locataires/nouveau">
            <Button>
              <Plus className="h-4 w-4" />
              Nouveau locataire
            </Button>
          </Link>
        </div>
      </div>

      {total === 0 && !pagination.search && Object.keys(pagination.filters ?? {}).length === 0 ? (
        <LocatairesEmptyState />
      ) : (
        <TenantsDataTable
          tenants={serialized}
          total={total}
          page={pagination.page}
          pageSize={pagination.pageSize}
          search={pagination.search}
          activeFilters={pagination.filters}
          viewSort={viewSort}
          groupBy={groupBy}
        />
      )}
    </div>
  );
}
