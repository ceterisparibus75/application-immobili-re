"use client";

import { ExportButton } from "@/components/export-button";
import type { CsvColumn } from "@/lib/export-csv";

interface LeaseRow {
  tenantName: string;
  building: string;
  lotNumber: string;
  leaseType: string;
  status: string;
  startDate: string;
  endDate: string;
  currentRentHT: number;
}

const STATUS_LABELS: Record<string, string> = {
  EN_COURS: "En cours", RESILIE: "Résilié", RENOUVELE: "Renouvelé",
  EN_NEGOCIATION: "En négociation", CONTENTIEUX: "Contentieux",
};

const columns: CsvColumn<LeaseRow>[] = [
  { header: "Locataire", accessor: (r) => r.tenantName },
  { header: "Immeuble", accessor: (r) => r.building },
  { header: "Lot", accessor: (r) => r.lotNumber },
  { header: "Type", accessor: (r) => r.leaseType },
  { header: "Statut", accessor: (r) => STATUS_LABELS[r.status] ?? r.status },
  { header: "Début", accessor: (r) => r.startDate },
  { header: "Fin", accessor: (r) => r.endDate },
  { header: "Loyer HT", accessor: (r) => r.currentRentHT.toFixed(2) },
];

export function ExportBaux({ data }: { data: LeaseRow[] }) {
  const ds = new Date().toISOString().slice(0, 10);
  return <ExportButton data={data} columns={columns} filename={`baux-${ds}`} />;
}
