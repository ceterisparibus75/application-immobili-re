"use client";

import { ExportButton } from "@/components/export-button";
import type { CsvColumn } from "@/lib/export-csv";

interface TenantRow {
  name: string;
  entityType: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  location: string | null;
  totalRent: number;
  riskLabel: string;
}

const columns: CsvColumn<TenantRow>[] = [
  { header: "Nom", accessor: (r) => r.name },
  { header: "Type", accessor: (r) => r.entityType === "PERSONNE_MORALE" ? "Société" : "Particulier" },
  { header: "Email", accessor: (r) => r.email },
  { header: "Téléphone", accessor: (r) => r.phone },
  { header: "Mobile", accessor: (r) => r.mobile },
  { header: "Bien", accessor: (r) => r.location },
  { header: "Loyer HT", accessor: (r) => r.totalRent.toFixed(2) },
  { header: "Risque", accessor: (r) => r.riskLabel },
];

export function ExportLocataires({ data }: { data: TenantRow[] }) {
  const ds = new Date().toISOString().slice(0, 10);
  return <ExportButton data={data} columns={columns} filename={`locataires-${ds}`} />;
}
