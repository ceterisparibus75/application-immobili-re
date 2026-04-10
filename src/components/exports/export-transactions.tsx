"use client";

import { ExportButton } from "@/components/export-button";
import type { CsvColumn } from "@/lib/export-csv";

interface TransactionRow {
  transactionDate: string;
  label: string;
  amount: number;
  reference: string;
  category: string;
  isReconciled: boolean;
}

const columns: CsvColumn<TransactionRow>[] = [
  { header: "Date", accessor: (r) => r.transactionDate },
  { header: "Libellé", accessor: (r) => r.label },
  { header: "Montant", accessor: (r) => r.amount.toFixed(2) },
  { header: "Référence", accessor: (r) => r.reference },
  { header: "Catégorie", accessor: (r) => r.category },
  { header: "Rapproché", accessor: (r) => r.isReconciled ? "Oui" : "Non" },
];

export function ExportTransactions({ data }: { data: TransactionRow[] }) {
  const ds = new Date().toISOString().slice(0, 10);
  return <ExportButton data={data} columns={columns} filename={`transactions-${ds}`} />;
}
