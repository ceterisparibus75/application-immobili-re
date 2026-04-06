"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn, type FilterOption } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ChargeRow {
  id: string;
  description: string;
  amount: number;
  date: Date;
  supplierName: string | null;
  isPaid: boolean;
  categoryName: string;
  nature: string;
  buildingName: string;
}

interface Props {
  charges: ChargeRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  activeFilters?: Record<string, string>;
  buildings: { id: string; name: string }[];
}

const NATURE_LABELS: Record<string, string> = {
  PROPRIETAIRE: "Propriétaire",
  RECUPERABLE: "Récupérable",
  MIXTE: "Mixte",
};

const NATURE_VARIANTS: Record<string, "default" | "secondary" | "warning"> = {
  PROPRIETAIRE: "secondary",
  RECUPERABLE: "default",
  MIXTE: "warning",
};

const columns: DataTableColumn<ChargeRow>[] = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    className: "w-[100px]",
    render: (row) => (
      <span className="text-sm tabular-nums">{formatDate(row.date)}</span>
    ),
  },
  {
    key: "description",
    label: "Description",
    sortable: true,
    render: (row) => (
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{row.description}</p>
        <p className="text-xs text-muted-foreground truncate">
          {row.categoryName}
          {row.supplierName && ` · ${row.supplierName}`}
        </p>
      </div>
    ),
  },
  {
    key: "buildingName",
    label: "Immeuble",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{row.buildingName}</span>
    ),
  },
  {
    key: "nature",
    label: "Nature",
    align: "center",
    render: (row) => (
      <Badge variant={NATURE_VARIANTS[row.nature] ?? "secondary"}>
        {NATURE_LABELS[row.nature] ?? row.nature}
      </Badge>
    ),
  },
  {
    key: "amount",
    label: "Montant",
    sortable: true,
    align: "right",
    render: (row) => (
      <span className="text-sm font-semibold tabular-nums">{formatCurrency(row.amount)}</span>
    ),
  },
  {
    key: "isPaid",
    label: "Statut",
    align: "center",
    render: (row) => (
      <Badge variant={row.isPaid ? "success" : "destructive"}>
        {row.isPaid ? "Réglée" : "Non réglée"}
      </Badge>
    ),
  },
];

export function ChargesDataTable({
  charges,
  total,
  page,
  pageSize,
  sortBy,
  sortOrder,
  search,
  activeFilters,
  buildings,
}: Props) {
  const filters: FilterOption[] = [
    {
      key: "buildingId",
      label: "Immeuble",
      options: buildings.map((b) => ({ value: b.id, label: b.name })),
    },
    {
      key: "isPaid",
      label: "Règlement",
      options: [
        { value: "true", label: "Réglées" },
        { value: "false", label: "Non réglées" },
      ],
    },
    {
      key: "nature",
      label: "Nature",
      options: [
        { value: "PROPRIETAIRE", label: "Propriétaire" },
        { value: "RECUPERABLE", label: "Récupérable" },
        { value: "MIXTE", label: "Mixte" },
      ],
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={charges}
      total={total}
      page={page}
      pageSize={pageSize}
      sortBy={sortBy}
      sortOrder={sortOrder}
      search={search}
      filters={filters}
      activeFilters={activeFilters}
      rowKey={(r) => r.id}
      rowHref={(r) => `/charges/${r.id}`}
      emptyMessage="Aucune charge trouvée"
    />
  );
}
