"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCsv, type CsvColumn } from "@/lib/export-csv";

interface ExportButtonProps<T> {
  data: T[];
  columns: CsvColumn<T>[];
  filename: string;
  label?: string;
}

export function ExportButton<T>({ data, columns, filename, label }: ExportButtonProps<T>) {
  if (data.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => downloadCsv(data, columns, filename)}
    >
      <Download className="h-4 w-4" />
      {label ?? "Exporter CSV"}
    </Button>
  );
}
