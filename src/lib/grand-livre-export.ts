export type GrandLivreExportRow = {
  id: string;
  accountCode: string;
  accountLabel: string;
  date: string | Date;
  piece: string | null;
  journalType: string;
  label: string;
  debit: number;
  credit: number;
  solde: number;
  lettrage: string | null;
  status: string;
};

export type GrandLivreExportGroup = {
  accountCode: string;
  accountLabel: string;
  totalDebit: number;
  totalCredit: number;
  endingBalance: number;
  rows: GrandLivreExportRow[];
};

export type GrandLivreExportPayload = {
  societyName: string;
  periodLabel: string;
  rows: GrandLivreExportRow[];
};

const DELIMITED_HEADERS = [
  "Compte",
  "Libellé compte",
  "Date",
  "Pièce",
  "Journal",
  "Libellé",
  "Débit",
  "Let.",
  "Crédit",
  "Solde",
  "Statut",
];

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatGrandLivreDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(date);
}

export function formatGrandLivreAmount(value: number): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeDelimited(value: string, separator: string): string {
  const clean = value.replace(/\r?\n|\r/g, " ").trim();
  if (!clean.includes(separator) && !clean.includes('"')) return clean;
  return `"${clean.replace(/"/g, '""')}"`;
}

export function buildGrandLivreExportGroups(rows: GrandLivreExportRow[]): GrandLivreExportGroup[] {
  const groups = new Map<string, GrandLivreExportGroup>();

  for (const row of rows) {
    const key = row.accountCode;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      existing.totalDebit = roundCents(existing.totalDebit + row.debit);
      existing.totalCredit = roundCents(existing.totalCredit + row.credit);
      existing.endingBalance = row.solde;
      continue;
    }

    groups.set(key, {
      accountCode: row.accountCode,
      accountLabel: row.accountLabel,
      totalDebit: roundCents(row.debit),
      totalCredit: roundCents(row.credit),
      endingBalance: row.solde,
      rows: [row],
    });
  }

  return Array.from(groups.values());
}

export function grandLivreRowsToDelimited(
  rows: GrandLivreExportRow[],
  separator: "," | ";" | "\t" = ";"
): string {
  const lines = [
    DELIMITED_HEADERS.map((header) => escapeDelimited(header, separator)).join(separator),
  ];

  for (const row of rows) {
    const values = [
      row.accountCode,
      row.accountLabel,
      formatGrandLivreDate(row.date),
      row.piece ?? "",
      row.journalType,
      row.label,
      formatGrandLivreAmount(row.debit),
      row.lettrage ?? "",
      formatGrandLivreAmount(row.credit),
      formatGrandLivreAmount(row.solde),
      row.status,
    ];
    lines.push(values.map((value) => escapeDelimited(value, separator)).join(separator));
  }

  return lines.join("\r\n");
}

export function grandLivreExportFilename(extension: "csv" | "txt" | "pdf", date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `grand-livre-${stamp}.${extension}`;
}
