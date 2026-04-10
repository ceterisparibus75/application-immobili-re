"use client";

import { ExportButton } from "@/components/export-button";
import type { CsvColumn } from "@/lib/export-csv";

interface ChargeRow {
  description: string;
  amount: number;
  date: string;
  supplierName: string;
  category: string;
  building: string;
  isPaid: boolean;
}

const columns: CsvColumn<ChargeRow>[] = [
  { header: "Description", accessor: (r) => r.description },
  { header: "Montant", accessor: (r) => r.amount.toFixed(2) },
  { header: "Date", accessor: (r) => r.date },
  { header: "Fournisseur", accessor: (r) => r.supplierName },
  { header: "Catégorie", accessor: (r) => r.category },
  { header: "Immeuble", accessor: (r) => r.building },
  { header: "Payée", accessor: (r) => r.isPaid ? "Oui" : "Non" },
];

export function ExportCharges({ data }: { data: ChargeRow[] }) {
  const ds = new Date().toISOString().slice(0, 10);
  return <ExportButton data={data} columns={columns} filename={`charges-${ds}`} />;
}
