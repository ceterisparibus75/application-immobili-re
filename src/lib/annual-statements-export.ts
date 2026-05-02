import type { AnnualStatementLine, AnnualStatements } from "@/actions/annual-statements";

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function formatCsvAmount(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

function formatCsvDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pushSection(rows: string[][], section: string, lines: AnnualStatementLine[], total: number): void {
  for (const line of lines) {
    rows.push([section, line.code, line.label, formatCsvAmount(line.amount)]);
  }
  rows.push([section, "TOTAL", `Total ${section.toLowerCase()}`, formatCsvAmount(total)]);
}

export function annualStatementsToCsv(statements: AnnualStatements): string {
  const rows: string[][] = [
    ["Exercice", String(statements.fiscalYear.year)],
    ["Période", `${formatCsvDate(statements.fiscalYear.startDate)} au ${formatCsvDate(statements.fiscalYear.endDate)}`],
    [],
    ["Section", "Compte", "Intitulé", "Montant"],
  ];

  pushSection(rows, "Actif", statements.balanceSheet.assets, statements.balanceSheet.totalAssets);
  pushSection(rows, "Passif", statements.balanceSheet.liabilities, statements.balanceSheet.totalLiabilities);
  pushSection(rows, "Charges", statements.incomeStatement.charges, statements.incomeStatement.totalCharges);
  pushSection(rows, "Produits", statements.incomeStatement.products, statements.incomeStatement.totalProducts);
  rows.push(["Résultat", "RESULTAT", "Résultat de l'exercice", formatCsvAmount(statements.incomeStatement.result)]);

  return `${rows.map((row) => row.map(escapeCsvValue).join(";")).join("\r\n")}\r\n`;
}

export function annualStatementsCsvFilename(statements: AnnualStatements): string {
  return `etats-annuels-${statements.fiscalYear.year}.csv`;
}
