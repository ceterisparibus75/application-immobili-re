"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type FilterOption } from "@/components/ui/data-table";
import { AlertTriangle, Building2, CheckCircle2, ClipboardCheck, User } from "lucide-react";
import Link from "next/link";

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
}

const columns: DataTableColumn<TenantRow>[] = [
  {
    key: "name",
    label: "Locataire",
    sortable: true,
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
    sortable: true,
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
    sortable: true,
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
}: Props) {
  return (
    <DataTable
      columns={columns}
      data={tenants}
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
      groupBy={(row) => ({
        key: row.buildingId ?? "no-building",
        label: row.buildingName ?? "Sans bail actif",
        sublabel: row.buildingAddress ?? undefined,
        icon: <Building2 className="h-4 w-4 text-primary shrink-0" />,
      })}
    />
  );
}
