/**
 * Generateur FEC -- Fichier des Ecritures Comptables
 * Format DGFiP (article L.47 A du Livre des Procedures Fiscales)
 * Separateur : tabulation, encodage UTF-8, CRLF
 */

import { prisma } from "@/lib/prisma";

const JOURNAL_CODES: Record<string, string> = {
  VENTES: "VT",
  BANQUE: "BQ",
  OPERATIONS_DIVERSES: "OD",
};

const JOURNAL_LIBS: Record<string, string> = {
  VENTES: "Journal des ventes",
  BANQUE: "Journal de banque",
  OPERATIONS_DIVERSES: "Journal des operations diverses",
};

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function fmtAmount(n: number): string {
  return n.toFixed(2);
}

function sanitize(s: string): string {
  return s.replace(/[\t\r\n]/g, " ").trim();
}

export interface FecOptions {
  year?: number;
  journalType?: "VENTES" | "BANQUE" | "OPERATIONS_DIVERSES";
  dateFrom?: Date;
  dateTo?: Date;
  validatedOnly?: boolean;
}

export interface FecAnomaly {
  entryId: string;
  piece: string | null;
  message: string;
  severity: "error" | "warning";
}

export interface FecStats {
  totalEntries: number;
  totalLines: number;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export interface FecResult {
  content: string;
  lineCount: number;
  anomalies: FecAnomaly[];
  stats: FecStats;
  filename: string;
}

export async function generateFec(
  societyId: string,
  options: FecOptions = {}
): Promise<FecResult> {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { siret: true },
  });
  const siren = society?.siret?.replace(/\s/g, "").slice(0, 9) ?? "000000000";

  const where: Record<string, unknown> = { societyId };

  if (options.validatedOnly) {
    where.isValidated = true;
  }

  if (options.year) {
    where.entryDate = {
      gte: new Date(`${options.year}-01-01T00:00:00.000Z`),
      lt: new Date(`${options.year + 1}-01-01T00:00:00.000Z`),
    };
  } else if (options.dateFrom || options.dateTo) {
    where.entryDate = {
      ...(options.dateFrom ? { gte: options.dateFrom } : {}),
      ...(options.dateTo ? { lte: options.dateTo } : {}),
    };
  }

  if (options.journalType) {
    where.journalType = options.journalType;
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: { select: { code: true, label: true } },
        },
      },
    },
    orderBy: [{ journalType: "asc" }, { entryDate: "asc" }, { createdAt: "asc" }],
  });

  const FEC_HEADER = [
    "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
    "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
    "PieceRef", "PieceDate", "EcritureLib",
    "Debit", "Credit", "EcritureLet", "DateLet",
    "ValidDate", "Montantdevise", "Idevise",
  ].join("\t");

  const rows: string[] = [FEC_HEADER];
  const anomalies: FecAnomaly[] = [];
  const counters: Record<string, number> = {};
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of entries) {
    const journalCode = JOURNAL_CODES[entry.journalType] ?? entry.journalType.slice(0, 3);
    counters[journalCode] = (counters[journalCode] ?? 0) + 1;
    const ecritureNum = `${journalCode}${String(counters[journalCode]).padStart(6, "0")}`;

    if (entry.lines.length === 0) {
      anomalies.push({
        entryId: entry.id,
        piece: entry.piece,
        message: `Ecriture ${ecritureNum} sans lignes`,
        severity: "error",
      });
      continue;
    }

    const eDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
    const eCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(eDebit - eCredit) > 0.01) {
      anomalies.push({
        entryId: entry.id,
        piece: entry.piece,
        message: `Ecriture ${ecritureNum} desequilibree : debit ${fmtAmount(eDebit)} != credit ${fmtAmount(eCredit)}`,
        severity: "error",
      });
    }

    const hasNegative = entry.lines.some((l) => l.debit < 0 || l.credit < 0);
    if (hasNegative) {
      anomalies.push({
        entryId: entry.id,
        piece: entry.piece,
        message: `Ecriture ${ecritureNum} contient des montants negatifs`,
        severity: "error",
      });
    }

    const validDate = entry.isValidated ? fmtDate(entry.entryDate) : "";
    const pieceRef = entry.piece ? sanitize(entry.piece) : "";
    const pieceDate = fmtDate(entry.entryDate);

    for (const line of entry.lines) {
      totalDebit += line.debit;
      totalCredit += line.credit;

      const lineLabel = sanitize(line.label ?? entry.label);

      rows.push([
        journalCode,
        sanitize(JOURNAL_LIBS[entry.journalType] ?? entry.journalType),
        ecritureNum,
        fmtDate(entry.entryDate),
        sanitize(line.account.code),
        sanitize(line.account.label),
        "",
        "",
        pieceRef,
        pieceDate,
        lineLabel,
        fmtAmount(line.debit),
        fmtAmount(line.credit),
        line.lettrage ? sanitize(line.lettrage) : "",
        "",
        validDate,
        "",
        "",
      ].join("\t"));
    }
  }

  if (entries.length > 0 && Math.abs(totalDebit - totalCredit) > 0.01) {
    anomalies.push({
      entryId: "global",
      piece: null,
      message: `Desequilibre global : total debit ${fmtAmount(totalDebit)} != total credit ${fmtAmount(totalCredit)}`,
      severity: "warning",
    });
  }

  const lineCount = rows.length - 1;
  const closingDate = options.year ? `${options.year}1231` : fmtDate(new Date());
  const filename = `${siren}_FEC_${closingDate}.txt`;

  return {
    content: rows.join("\r\n"),
    lineCount,
    anomalies,
    stats: {
      totalEntries: entries.length,
      totalLines: lineCount,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) <= 0.01,
    },
    filename,
  };
}
