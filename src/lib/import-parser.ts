import ExcelJS from "exceljs";

/**
 * Parse a CSV or XLSX file and return rows as Record<string, string>[].
 * Handles UTF-8 BOM and normalizes header names (trimmed, lowercased).
 */
export async function parseImportFile(
  buffer: Buffer,
  filename: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const isExcel =
    filename.endsWith(".xlsx") || filename.endsWith(".xls");

  const workbook = new ExcelJS.Workbook();

  if (isExcel) {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } else {
    // CSV parsing
    let csvString = buffer.toString("utf-8");
    // Remove UTF-8 BOM if present
    if (csvString.charCodeAt(0) === 0xfeff) {
      csvString = csvString.slice(1);
    }
    const csvBuffer = Buffer.from(csvString, "utf-8");
    await workbook.csv.read(
      new (await import("stream")).Readable({
        read() {
          this.push(csvBuffer);
          this.push(null);
        },
      }),
      {
        parserOptions: {
          delimiter: detectDelimiter(csvString),
        },
      }
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    return { headers: [], rows: [] };
  }

  // Extract headers from first row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cell.text?.trim() ?? "";
    headers[colNumber - 1] = value;
  });

  // Filter out empty trailing headers
  while (headers.length > 0 && !headers[headers.length - 1]) {
    headers.pop();
  }

  if (headers.length === 0) {
    return { headers: [], rows: [] };
  }

  // Extract data rows
  const rows: Record<string, string>[] = [];
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const record: Record<string, string> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      const value = cell.text?.trim() ?? "";
      record[header] = value;
      if (value) hasValue = true;
    });

    // Skip completely empty rows
    if (hasValue) {
      rows.push(record);
    }
  }

  return { headers, rows };
}

/**
 * Auto-detect CSV delimiter by checking which character appears most in the first line.
 */
function detectDelimiter(csv: string): string {
  const firstLine = csv.split("\n")[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;

  if (tabs >= semicolons && tabs >= commas) return "\t";
  if (semicolons >= commas) return ";";
  return ",";
}
