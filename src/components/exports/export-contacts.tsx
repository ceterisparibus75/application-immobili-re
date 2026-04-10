"use client";

import { ExportButton } from "@/components/export-button";
import type { CsvColumn } from "@/lib/export-csv";

interface ContactRow {
  name: string;
  contactType: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  specialty?: string | null;
  city?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  LOCATAIRE: "Locataire", PRESTATAIRE: "Prestataire", NOTAIRE: "Notaire",
  EXPERT: "Expert", SYNDIC: "Syndic", AGENCE: "Agence", AUTRE: "Autre",
};

const columns: CsvColumn<ContactRow>[] = [
  { header: "Nom", accessor: (r) => r.name },
  { header: "Type", accessor: (r) => TYPE_LABELS[r.contactType] ?? r.contactType },
  { header: "Société", accessor: (r) => r.company },
  { header: "Spécialité", accessor: (r) => r.specialty },
  { header: "Email", accessor: (r) => r.email },
  { header: "Téléphone", accessor: (r) => r.phone },
  { header: "Mobile", accessor: (r) => r.mobile },
  { header: "Ville", accessor: (r) => r.city },
];

export function ExportContacts({ data }: { data: ContactRow[] }) {
  const ds = new Date().toISOString().slice(0, 10);
  return <ExportButton data={data} columns={columns} filename={`contacts-${ds}`} />;
}
