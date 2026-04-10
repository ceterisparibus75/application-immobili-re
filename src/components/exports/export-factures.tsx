"use client";

import { ExportButton } from "@/components/export-button";
import type { CsvColumn } from "@/lib/export-csv";

interface InvoiceRow {
  invoiceNumber: string;
  status: string;
  tenantName: string;
  issueDate: string;
  dueDate: string;
  totalHT: number;
  totalTTC: number;
  building: string;
}

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon", EMISE: "Émise", PAYEE: "Payée",
  EN_RETARD: "En retard", PARTIELLEMENT_PAYEE: "Partiel",
  ANNULEE: "Annulée", AVOIR: "Avoir",
};

const columns: CsvColumn<InvoiceRow>[] = [
  { header: "N° Facture", accessor: (r) => r.invoiceNumber },
  { header: "Statut", accessor: (r) => STATUS_LABELS[r.status] ?? r.status },
  { header: "Locataire", accessor: (r) => r.tenantName },
  { header: "Immeuble", accessor: (r) => r.building },
  { header: "Date émission", accessor: (r) => r.issueDate },
  { header: "Date échéance", accessor: (r) => r.dueDate },
  { header: "Total HT", accessor: (r) => r.totalHT.toFixed(2) },
  { header: "Total TTC", accessor: (r) => r.totalTTC.toFixed(2) },
];

export function ExportFactures({ data }: { data: InvoiceRow[] }) {
  const ds = new Date().toISOString().slice(0, 10);
  return <ExportButton data={data} columns={columns} filename={`factures-${ds}`} />;
}
