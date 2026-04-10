/**
 * Utilitaire d'export CSV générique.
 * Gère les séparateurs français (;), l'encodage UTF-8 BOM,
 * et l'échappement des valeurs contenant des guillemets ou points-virgules.
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/** Échappe une valeur CSV (guillemets, points-virgules, retours à la ligne) */
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(";") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Génère une string CSV à partir de données et colonnes */
export function generateCsv<T>(data: T[], columns: CsvColumn<T>[]): string {
  const headerRow = columns.map((c) => escapeCsv(c.header)).join(";");
  const dataRows = data.map((row) =>
    columns.map((c) => escapeCsv(c.accessor(row))).join(";")
  );
  return [headerRow, ...dataRows].join("\r\n");
}

/** Déclenche le téléchargement d'un fichier CSV côté client */
export function downloadCsv<T>(data: T[], columns: CsvColumn<T>[], filename: string): void {
  const csv = generateCsv(data, columns);
  // BOM UTF-8 pour que Excel reconnaisse l'encodage
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
