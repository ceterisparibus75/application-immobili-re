import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import ExcelJS from "exceljs";

export type ParsedEntry = {
  journalCode: string;
  entryDate: string;
  piece: string;
  label: string;
  lines: Array<{
    accountCode: string;
    accountLabel: string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
};

function parseFecDate(s: string): string {
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function parseAmount(s: string): number {
  if (!s) return 0;
  const cleaned = s.toString().replace(/\s/g, "").replace(",", ".");
  return Math.round(parseFloat(cleaned || "0") * 100) / 100 || 0;
}

function normHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseFec(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const firstLine = lines[0];
  const sep = firstLine.includes("	") ? "	" : firstLine.includes("|") ? "|" : ";";
  const headers = firstLine.split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex((h) => normHeader(h) === normHeader(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iJournal = idx(["JournalCode", "CodeJournal", "Journal"]);
  const iNum = idx(["EcritureNum", "NumEcriture", "Numero"]);
  const iDate = idx(["EcritureDate", "DateEcriture", "Date"]);
  const iCompte = idx(["CompteNum", "NumCompte", "Compte"]);
  const iCompteLib = idx(["CompteLib", "LibCompte", "LibelleCompte"]);
  const iLib = idx(["EcritureLib", "LibEcriture", "Libelle"]);
  const iDebit = idx(["Debit", "MontantDebit"]);
  const iCredit = idx(["Credit", "MontantCredit"]);
  const iPiece = idx(["PieceRef", "EcritureNum", "Piece"]);
  if (iJournal < 0 || iDate < 0 || iCompte < 0) return [];
  const rawEntries = new Map<string, ParsedEntry>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const journalCode = cols[iJournal] ?? "";
    const num = iNum >= 0 ? (cols[iNum] ?? `L${i}`) : `L${i}`;
    const dateRaw = cols[iDate] ?? "";
    const compteNum = cols[iCompte] ?? "";
    const compteLib = iCompteLib >= 0 ? (cols[iCompteLib] ?? compteNum) : compteNum;
    const lib = iLib >= 0 ? (cols[iLib] ?? "") : "";
    const debit = parseAmount(iDebit >= 0 ? (cols[iDebit] ?? "0") : "0");
    const credit = parseAmount(iCredit >= 0 ? (cols[iCredit] ?? "0") : "0");
    const piece = iPiece >= 0 ? (cols[iPiece] ?? num) : num;
    if (!compteNum) continue;
    const key = `${journalCode}|${num}|${dateRaw}`;
    if (!rawEntries.has(key)) {
      rawEntries.set(key, {
        journalCode,
        entryDate: parseFecDate(dateRaw),
        piece: piece || num,
        label: lib,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
      });
    }
    const entry = rawEntries.get(key)!;
    if (lib && !entry.label) entry.label = lib;
    entry.lines.push({ accountCode: compteNum, accountLabel: compteLib, debit, credit });
    entry.totalDebit = Math.round((entry.totalDebit + debit) * 100) / 100;
    entry.totalCredit = Math.round((entry.totalCredit + credit) * 100) / 100;
  }
  const result = Array.from(rawEntries.values());
  result.forEach((e) => {
    e.isBalanced = Math.abs(e.totalDebit - e.totalCredit) < 0.02;
  });
  return result;
}

async function parseExcel(arrayBuffer: ArrayBuffer): Promise<ParsedEntry[]> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (wb.xlsx.load as any)(Buffer.from(arrayBuffer));
  const ws = wb.worksheets[0];
  if (!ws) return [];
  let headerRow = 1;
  const headerCols: Record<string, number> = {};
  const COL_PATTERNS: Record<string, string[]> = {
    date: ["date", "date comptable", "date ecriture", "datecomptable"],
    journal: ["journal", "code journal", "codejournal", "jnl"],
    piece: ["piece", "no piece", "n piece", "ref", "ecriture num", "ecriturenum"],
    label: ["libelle", "label", "description", "designation"],
    account: ["compte", "no compte", "comptenum", "compte general"],
    debit: ["debit", "montant debit"],
    credit: ["credit", "montant credit"],
  };
  ws.eachRow((row, rowNumber) => {
    if (Object.keys(headerCols).length >= 4) return;
    let matchCount = 0;
    row.eachCell((cell, colNumber) => {
      const val = normHeader(String(cell.value ?? ""));
      for (const [key, patterns] of Object.entries(COL_PATTERNS)) {
        if (!headerCols[key] && patterns.includes(val)) {
          headerCols[key] = colNumber;
          matchCount++;
        }
      }
    });
    if (matchCount >= 4) headerRow = rowNumber;
  });
  if (!headerCols.account) return [];
  const rawEntries = new Map<string, ParsedEntry>();
  let rowIndex = 0;
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const getVal = (key: string) => {
      const col = headerCols[key];
      if (!col) return "";
      const cell = row.getCell(col);
      if (cell.value === null || cell.value === undefined) return "";
      return String(cell.value).trim();
    };
    const accountCode = getVal("account");
    if (!accountCode || !/^\d/.test(accountCode)) return;
    rowIndex++;
    let isoDate = new Date().toISOString().slice(0, 10);
    const col = headerCols["date"];
    if (col) {
      const cell = row.getCell(col);
      if (cell.value instanceof Date) {
        isoDate = cell.value.toISOString().slice(0, 10);
      } else if (cell.value) {
        isoDate = parseFecDate(
          String(cell.value).replace(/\//g, "").replace(/-/g, "").slice(0, 8)
        );
      }
    }
    const journalCode = getVal("journal") || "OD";
    const piece = getVal("piece") || `L${rowIndex}`;
    const label = getVal("label") || `Ecriture ${rowIndex}`;
    const debit = parseAmount(getVal("debit"));
    const credit = parseAmount(getVal("credit"));
    const key = `${journalCode}|${piece}|${isoDate}`;
    if (!rawEntries.has(key)) {
      rawEntries.set(key, {
        journalCode,
        entryDate: isoDate,
        piece,
        label,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
      });
    }
    const entry = rawEntries.get(key)!;
    entry.lines.push({ accountCode, accountLabel: accountCode, debit, credit });
    entry.totalDebit = Math.round((entry.totalDebit + debit) * 100) / 100;
    entry.totalCredit = Math.round((entry.totalCredit + credit) * 100) / 100;
  });
  const result = Array.from(rawEntries.values());
  result.forEach((e) => {
    e.isBalanced = Math.abs(e.totalDebit - e.totalCredit) < 0.02;
  });
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié" } },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json(
        { error: { code: "NO_SOCIETY", message: "Aucune société active" } },
        { status: 400 }
      );
    }

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: { code: "NO_FILE", message: "Aucun fichier fourni" } },
        { status: 400 }
      );
    }
    const filename = file.name.toLowerCase();
    const fileArrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileArrayBuffer);
    let entries: ParsedEntry[] = [];
    let source: string;
    if (
      filename.endsWith(".xlsx") ||
      filename.endsWith(".xls") ||
      filename.endsWith(".ods")
    ) {
      entries = await parseExcel(fileArrayBuffer);
      source = "excel";
    } else {
      const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
      entries = parseFec(text);
      source = entries.length > 0 ? "fec" : "unknown";
      if (source === "unknown") {
        return NextResponse.json(
          {
            error: {
              code: "PARSE_ERROR",
              message:
                "Format non reconnu. Utilisez un export FEC (.txt, .csv) ou Excel (.xlsx).",
            },
          },
          { status: 400 }
        );
      }
    }
    return NextResponse.json({ entries, source, total: entries.length });
  } catch (error) {
    console.error("[import-grand-livre]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Erreur lors de l'analyse du fichier" } },
      { status: 500 }
    );
  }
}
