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

const ACCOUNTING_TEXT_COLUMNS: Array<{ key: string; label: string; width: number }> = [
  { key: "accountCode", label: "Compte", width: 14 },
  { key: "accountLabel", label: "Libellé compte", width: 52 },
  { key: "journalType", label: "Journal", width: 9 },
  { key: "date", label: "Date écriture", width: 14 },
  { key: "piece", label: "Pièce", width: 17 },
  { key: "label", label: "Libellé écriture", width: 52 },
  { key: "debitOrigine", label: "Débit origine", width: 14 },
  { key: "creditOrigine", label: "Crédit origine", width: 15 },
  { key: "debitEuro", label: "Débit euro", width: 12 },
  { key: "creditEuro", label: "Crédit euro", width: 13 },
  { key: "lettrageN", label: "Lettrage N", width: 11 },
  { key: "lettrageN1", label: "Lettrage N+1", width: 13 },
  { key: "lettragePartiel", label: "Lettrage partiel", width: 17 },
  { key: "revision", label: "Révision", width: 9 },
  { key: "year", label: "Année", width: 11 },
  { key: "month", label: "Mois", width: 11 },
  { key: "day", label: "Jour", width: 11 },
  { key: "currencyIso", label: "Monnaie ISO", width: 12 },
  { key: "currency", label: "Monnaie", width: 9 },
  { key: "exchangeRate", label: "Taux change", width: 12 },
  { key: "paymentType", label: "Type règlement", width: 15 },
  { key: "quantity1", label: "Quantité 1", width: 11 },
  { key: "unit1", label: "Unité 1", width: 11 },
  { key: "quantity2", label: "Quantité 2", width: 11 },
  { key: "unit2", label: "Unité 2", width: 8 },
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

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function padAccountingText(value: string, width: number): string {
  const clean = value.replace(/\r?\n|\r/g, " ").trim();
  return clean.length >= width ? `${clean} ` : clean.padEnd(width, " ");
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

export function grandLivreRowsToAccountingText(rows: GrandLivreExportRow[]): string {
  const header = ACCOUNTING_TEXT_COLUMNS
    .map((column) => padAccountingText(column.label, column.width))
    .join("");
  const lines = [header];

  for (const row of rows) {
    const date = toDate(row.date);
    const dateLabel = date ? formatGrandLivreDate(date) : "";
    const year = date ? String(date.getFullYear()) : "";
    const month = date ? String(date.getMonth() + 1) : "";
    const day = date ? String(date.getDate()) : "";
    const values: Record<string, string> = {
      accountCode: row.accountCode,
      accountLabel: row.accountLabel,
      journalType: row.journalType,
      date: dateLabel,
      piece: row.piece ?? "",
      label: row.label,
      debitOrigine: formatGrandLivreAmount(row.debit),
      creditOrigine: formatGrandLivreAmount(row.credit),
      debitEuro: formatGrandLivreAmount(row.debit),
      creditEuro: formatGrandLivreAmount(row.credit),
      lettrageN: row.lettrage ?? "",
      lettrageN1: "",
      lettragePartiel: "Faux",
      revision: "Faux",
      year,
      month,
      day,
      currencyIso: "E",
      currency: "",
      exchangeRate: "1",
      paymentType: "R",
      quantity1: "0",
      unit1: "",
      quantity2: "0",
      unit2: "",
    };
    lines.push(
      ACCOUNTING_TEXT_COLUMNS
        .map((column) => padAccountingText(values[column.key] ?? "", column.width))
        .join("")
    );
  }

  return lines.join("\r\n");
}

export function grandLivreExportFilename(extension: "csv" | "txt" | "pdf", date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `grand-livre-${stamp}.${extension}`;
}
