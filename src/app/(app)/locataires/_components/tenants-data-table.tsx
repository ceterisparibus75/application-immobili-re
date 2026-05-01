"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type FilterOption } from "@/components/ui/data-table";
import { AlertTriangle, Building2, CheckCircle2, ClipboardCheck, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export type TenantViewSort =
  | "alpha"
  | "entry-desc"
  | "entry-asc"
  | "building"
  | "balance-desc"
  | "rent-desc"
  | "risk"
  | "dossier"
  | "last-login-desc";

export type TenantGroupBy = "none" | "building" | "risk" | "dossier" | "insurance";

interface TenantRow {
  id: string;
  entityType: string;
  name: string;
  email: string | null;
  phone: string | null;
  dossier: {
    status: "complete" | "missing" | "critical";
    label: string;
    missing: string[];
    variant: "success" | "warning" | "destructive";
  };
  insurance: { label: string; variant: "success" | "warning" | "destructive" | "secondary" };
  riskVariant: "success" | "warning" | "destructive";
  riskLabel: string;
  totalRent: number;
  balance: number;
  _count: { leases: number };
  isActive: boolean;
  buildingId: string | null;
  buildingName: string | null;
  buildingAddress: string | null;
  lotLabel: string | null;
  entryDate: string | null;
  entryDateLabel: string | null;
  portal: {
    isActive: boolean;
    invitedAt: string;
    invitedAtLabel: string | null;
    lastLoginAt: string | null;
    lastLoginAtLabel: string | null;
    daysSinceLastLogin: number | null;
    activationPending: boolean;
  } | null;
}

interface Props {
  tenants: TenantRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  activeFilters?: Record<string, string>;
  viewSort?: TenantViewSort;
  groupBy?: TenantGroupBy;
}

const SORT_OPTIONS: { value: TenantViewSort; label: string }[] = [
  { value: "alpha", label: "Alphabétique" },
  { value: "entry-desc", label: "Date d'entrée récente" },
  { value: "entry-asc", label: "Date d'entrée ancienne" },
  { value: "building", label: "Immeuble" },
  { value: "balance-desc", label: "Solde décroissant" },
  { value: "rent-desc", label: "Loyer décroissant" },
  { value: "risk", label: "Risque" },
  { value: "dossier", label: "Dossier incomplet" },
  { value: "last-login-desc", label: "Dernière connexion" },
];

const GROUP_OPTIONS: { value: TenantGroupBy; label: string }[] = [
  { value: "none", label: "Aucun" },
  { value: "building", label: "Immeuble" },
  { value: "risk", label: "Risque" },
  { value: "dossier", label: "Dossier" },
  { value: "insurance", label: "Assurance" },
];

const RISK_ORDER: Record<TenantRow["riskVariant"], number> = {
  destructive: 0,
  warning: 1,
  success: 2,
};

const DOSSIER_ORDER: Record<TenantRow["dossier"]["status"], number> = {
  critical: 0,
  missing: 1,
  complete: 2,
};

function compareText(a?: string | null, b?: string | null) {
  return (a ?? "").localeCompare(b ?? "", "fr", { sensitivity: "base" });
}

function compareDate(a?: string | null, b?: string | null) {
  const left = a ? new Date(a).getTime() : 0;
  const right = b ? new Date(b).getTime() : 0;
  return left - right;
}

function portalStatus(row: TenantRow): {
  label: string;
  detail: string;
  variant: "success" | "warning" | "destructive" | "secondary";
} {
  if (!row.portal || !row.portal.isActive) {
    return { label: "Sans accès", detail: "Portail non activé", variant: "secondary" };
  }
  if (row.portal.activationPending) {
    return {
      label: "Invitation en attente",
      detail: row.portal.invitedAtLabel ? `Invitée le ${row.portal.invitedAtLabel}` : "Code d'activation envoyé",
      variant: "warning",
    };
  }
  if (!row.portal.lastLoginAt) {
    return { label: "Jamais connecté", detail: "Accès actif", variant: "warning" };
  }
  if ((row.portal.daysSinceLastLogin ?? 0) >= 90) {
    return { label: "Inactif 90j", detail: `Dernière connexion ${row.portal.lastLoginAtLabel}`, variant: "destructive" };
  }
  if ((row.portal.daysSinceLastLogin ?? 0) >= 30) {
    return { label: "Inactif 30j", detail: `Dernière connexion ${row.portal.lastLoginAtLabel}`, variant: "warning" };
  }
  return { label: "Accès actif", detail: `Dernière connexion ${row.portal.lastLoginAtLabel}`, variant: "success" };
}

function sortTenants(tenants: TenantRow[], viewSort: TenantViewSort, groupBy: TenantGroupBy) {
  return [...tenants].sort((a, b) => {
    const groupCompare = groupBy === "none" ? 0 : compareGroup(a, b, groupBy);
    if (groupCompare !== 0) return groupCompare;

    switch (viewSort) {
      case "entry-desc":
        return compareDate(b.entryDate, a.entryDate) || compareText(a.name, b.name);
      case "entry-asc":
        return compareDate(a.entryDate, b.entryDate) || compareText(a.name, b.name);
      case "building":
        return compareText(a.buildingName, b.buildingName) || compareText(a.name, b.name);
      case "balance-desc":
        return b.balance - a.balance || compareText(a.name, b.name);
      case "rent-desc":
        return b.totalRent - a.totalRent || compareText(a.name, b.name);
      case "risk":
        return RISK_ORDER[a.riskVariant] - RISK_ORDER[b.riskVariant] || compareText(a.name, b.name);
      case "dossier":
        return DOSSIER_ORDER[a.dossier.status] - DOSSIER_ORDER[b.dossier.status] || compareText(a.name, b.name);
      case "last-login-desc":
        return compareDate(b.portal?.lastLoginAt, a.portal?.lastLoginAt) || compareText(a.name, b.name);
      case "alpha":
      default:
        return compareText(a.name, b.name);
    }
  });
}

function compareGroup(a: TenantRow, b: TenantRow, groupBy: TenantGroupBy) {
  switch (groupBy) {
    case "building":
      return compareText(a.buildingName ?? "zzz", b.buildingName ?? "zzz");
    case "risk":
      return RISK_ORDER[a.riskVariant] - RISK_ORDER[b.riskVariant];
    case "dossier":
      return DOSSIER_ORDER[a.dossier.status] - DOSSIER_ORDER[b.dossier.status];
    case "insurance":
      return compareText(a.insurance.label, b.insurance.label);
    case "none":
    default:
      return 0;
  }
}

function buildColumns(groupBy: TenantGroupBy): DataTableColumn<TenantRow>[] {
  return [
  {
    key: "name",
    label: "Locataire",
    render: (row) => (
      <Link href={`/locataires/${row.id}`} className="flex items-center gap-2.5 min-w-0 hover:opacity-80" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          {row.entityType === "PERSONNE_MORALE" ? (
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.name}</p>
          <p className="text-xs text-muted-foreground truncate">{row.email}</p>
        </div>
      </Link>
    ),
  },
  ...(groupBy === "building"
    ? []
    : [
        {
          key: "building",
          label: "Immeuble",
          render: (row) => (
            <div className="max-w-[260px]">
              <p className="text-sm font-medium truncate">{row.buildingName ?? "Sans bail actif"}</p>
              {row.buildingAddress && (
                <p className="text-xs text-muted-foreground truncate">{row.buildingAddress}</p>
              )}
            </div>
          ),
        } satisfies DataTableColumn<TenantRow>,
      ]),
  {
    key: "lot",
    label: "Lot / Bail",
    render: (row) => (
      <div className="max-w-[170px]">
        <p className="text-sm font-medium truncate">{row.lotLabel ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {row.entryDateLabel ? `Entrée ${row.entryDateLabel}` : "Date d'entrée —"}
        </p>
      </div>
    ),
  },
  {
    key: "dossier",
    label: "Dossier",
    render: (row) => {
      const Icon = row.dossier.status === "complete"
        ? CheckCircle2
        : row.dossier.status === "critical"
          ? AlertTriangle
          : ClipboardCheck;
      const preview = row.dossier.missing.slice(0, 3).join(", ");
      return (
        <Link
          href={`/locataires/${row.id}/modifier`}
          className="inline-flex max-w-[210px] flex-col items-start gap-1 hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
          title={row.dossier.missing.length > 0 ? row.dossier.missing.join(", ") : "Dossier complet"}
        >
          <Badge variant={row.dossier.variant} className="gap-1 text-[11px]">
            <Icon className="h-3 w-3" />
            {row.dossier.label}
          </Badge>
          {preview && (
            <span className="block max-w-full truncate text-xs text-muted-foreground">
              {preview}
            </span>
          )}
        </Link>
      );
    },
  },
  {
    key: "portal",
    label: "Portail",
    render: (row) => {
      const status = portalStatus(row);
      return (
        <div className="max-w-[190px]">
          <Badge variant={status.variant} className="text-[11px]">
            {status.label}
          </Badge>
          <p className="mt-1 truncate text-xs text-muted-foreground">{status.detail}</p>
        </div>
      );
    },
  },
  {
    key: "insurance",
    label: "Assurance",
    align: "center",
    render: (row) => (
      <Badge variant={row.insurance.variant} className="text-[11px]">
        {row.insurance.label}
      </Badge>
    ),
  },
  {
    key: "riskIndicator",
    label: "Risque",
    align: "center",
    render: (row) => (
      <Badge variant={row.riskVariant} className="text-[11px]">
        {row.riskLabel}
      </Badge>
    ),
  },
  {
    key: "totalRent",
    label: "Loyer HT",
    align: "right",
    render: (row) =>
      row.totalRent > 0 ? (
        <span className="text-sm font-semibold tabular-nums">
          {row.totalRent.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "balance",
    label: "Solde",
    align: "right",
    render: (row) => {
      if (row.balance === 0) {
        return <span className="text-sm text-muted-foreground tabular-nums">0,00 €</span>;
      }
      const isDebt = row.balance > 0;
      return (
        <span className={`text-sm font-semibold tabular-nums ${isDebt ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
          {isDebt ? "+" : ""}{row.balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
        </span>
      );
    },
  },
  ];
}

const FILTERS: FilterOption[] = [
  {
    key: "status",
    label: "Statut",
    options: [
      { value: "active", label: "Actifs" },
      { value: "inactive", label: "Inactifs" },
    ],
  },
  {
    key: "dossier",
    label: "Dossier",
    options: [
      { value: "complete", label: "Complets" },
      { value: "missing", label: "À compléter" },
      { value: "critical", label: "Critiques" },
    ],
  },
  {
    key: "entityType",
    label: "Type",
    options: [
      { value: "PERSONNE_PHYSIQUE", label: "Particulier" },
      { value: "PERSONNE_MORALE", label: "Société" },
    ],
  },
  {
    key: "portal",
    label: "Portail",
    options: [
      { value: "active", label: "Accès activé" },
      { value: "no_access", label: "Sans accès" },
      { value: "pending", label: "Invitation en attente" },
      { value: "never_connected", label: "Jamais connecté" },
      { value: "recent", label: "Connecté récemment" },
      { value: "inactive_30", label: "Inactif 30 jours" },
      { value: "inactive_90", label: "Inactif 90 jours" },
    ],
  },
];

export function TenantsDataTable({
  tenants,
  total,
  page,
  pageSize,
  sortBy,
  sortOrder,
  search,
  activeFilters,
  viewSort = "alpha",
  groupBy = "none",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columns = useMemo(() => buildColumns(groupBy), [groupBy]);
  const sortedTenants = useMemo(() => sortTenants(tenants, viewSort, groupBy), [tenants, viewSort, groupBy]);

  function updateViewParam(key: "viewSort" | "groupBy", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if ((key === "viewSort" && value === "alpha") || (key === "groupBy" && value === "none")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Présentation
        </span>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Trier par</span>
          <select
            value={viewSort}
            onChange={(e) => updateViewParam("viewSort", e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Regrouper par</span>
          <select
            value={groupBy}
            onChange={(e) => updateViewParam("groupBy", e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {GROUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        columns={columns}
        data={sortedTenants}
        total={total}
        page={page}
        pageSize={pageSize}
        sortBy={sortBy}
        sortOrder={sortOrder}
        search={search}
        filters={FILTERS}
        activeFilters={activeFilters}
        rowKey={(r) => r.id}
        rowHref={(r) => `/locataires/${r.id}`}
        emptyMessage="Aucun locataire trouvé"
        groupBy={groupBy === "none" ? undefined : (row) => {
          if (groupBy === "building") {
            return {
              key: row.buildingId ?? "no-building",
              label: row.buildingName ?? "Sans bail actif",
              sublabel: row.buildingAddress ?? undefined,
              icon: <Building2 className="h-4 w-4 text-primary shrink-0" />,
            };
          }
          if (groupBy === "risk") {
            return {
              key: row.riskVariant,
              label: row.riskLabel,
              icon: <AlertTriangle className="h-4 w-4 text-primary shrink-0" />,
            };
          }
          if (groupBy === "dossier") {
            return {
              key: row.dossier.status,
              label: row.dossier.status === "complete" ? "Dossiers complets" : row.dossier.status === "critical" ? "Dossiers critiques" : "Dossiers à compléter",
              icon: <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />,
            };
          }
          return {
            key: row.insurance.label,
            label: row.insurance.label,
            icon: <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />,
          };
        }}
      />
    </div>
  );
}
