/**
 * Generateur FEC -- Fichier des Ecritures Comptables
 * Format DGFiP (article A.47 A-1 du Livre des Procedures Fiscales)
 * Separateur : tabulation, encodage UTF-8, CRLF
 */

import { prisma } from "@/lib/prisma";
import {
  ACCOUNTING_JOURNAL_LABELS,
  type CanonicalAccountingJournalType,
  getAccountingJournalTypeAliases,
  isAccountingJournalType,
  normalizeAccountingJournalType,
} from "@/lib/accounting-journals";
import type { JournalType } from "@/generated/prisma/client";

const FEC_JOURNAL_CODES: Record<CanonicalAccountingJournalType, string> = {
  AN: "AN",
  AC: "AC",
  VT: "VT",
  BQUE: "BQ",
  OD: "OD",
  INV: "IN",
};

const FEC_HEADER = [
  "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
  "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
  "PieceRef", "PieceDate", "EcritureLib",
  "Debit", "Credit", "EcritureLet", "DateLet",
  "ValidDate", "Montantdevise", "Idevise",
].join("\t");

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
  fiscalYearId?: string;
  year?: number;
  journalType?: JournalType;
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

  // Recuperer l exercice fiscal si fiscalYearId est fourni
  let fiscalYear: { year: number; startDate: Date; endDate: Date } | null = null;
  if (options.fiscalYearId) {
    fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: options.fiscalYearId, societyId },
      select: { year: true, startDate: true, endDate: true },
    });
    if (!fiscalYear) {
      return {
        content: FEC_HEADER,
        lineCount: 0,
        anomalies: [
          {
            entryId: options.fiscalYearId,
            piece: null,
            message: "Exercice fiscal introuvable pour cette société",
            severity: "error",
          },
        ],
        stats: {
          totalEntries: 0,
          totalLines: 0,
          totalDebit: 0,
          totalCredit: 0,
          balanced: true,
        },
        filename: `${siren}FEC${fmtDate(new Date())}.txt`,
      };
    }
  }

  const where: Record<string, unknown> = { societyId };

  if (options.validatedOnly) {
    where.isValidated = true;
  }

  if (fiscalYear) {
    where.entryDate = {
      gte: fiscalYear.startDate,
      lte: fiscalYear.endDate,
    };
  } else if (options.year) {
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
    where.journalType = isAccountingJournalType(options.journalType)
      ? { in: getAccountingJournalTypeAliases(options.journalType) }
      : options.journalType;
  }
  const entries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: { select: { code: true, label: true } },
          auxiliaryProprietaire: { select: { id: true, label: true } },
        },
      },
    },
    orderBy: [{ journalType: "asc" }, { entryDate: "asc" }, { createdAt: "asc" }],
  });

  const rows: string[] = [FEC_HEADER];
  const anomalies: FecAnomaly[] = [];
  const counters: Record<string, number> = {};
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of entries) {
    const canonicalJournalType = isAccountingJournalType(entry.journalType)
      ? normalizeAccountingJournalType(entry.journalType)
      : null;
    const journalCode = canonicalJournalType
      ? FEC_JOURNAL_CODES[canonicalJournalType]
      : entry.journalType.slice(0, 3);
    const journalLib = canonicalJournalType
      ? "Journal - " + ACCOUNTING_JOURNAL_LABELS[canonicalJournalType]
      : entry.journalType;
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

    if (!entry.piece) {
      anomalies.push({
        entryId: entry.id,
        piece: entry.piece,
        message: `Ecriture ${ecritureNum} sans reference de piece`,
        severity: "warning",
      });
    }

    if (!entry.isValidated) {
      anomalies.push({
        entryId: entry.id,
        piece: entry.piece,
        message: `Ecriture ${ecritureNum} non validee`,
        severity: "warning",
      });
    }

    const validDate = entry.isValidated ? fmtDate(entry.entryDate) : "";
    const pieceRef = entry.piece ? sanitize(entry.piece) : "";
    const pieceDate = fmtDate(entry.entryDate);
    for (const line of entry.lines) {
      if (line.debit > 0 && line.credit > 0) {
        anomalies.push({
          entryId: entry.id,
          piece: entry.piece,
          message: `Ecriture ${ecritureNum} contient une ligne avec debit et credit renseignes`,
          severity: "error",
        });
      }
      if (line.debit === 0 && line.credit === 0) {
        anomalies.push({
          entryId: entry.id,
          piece: entry.piece,
          message: `Ecriture ${ecritureNum} contient une ligne sans montant`,
          severity: "error",
        });
      }

      totalDebit += line.debit;
      totalCredit += line.credit;

      const lineLabel = sanitize(line.label ?? entry.label);

      // EcritureLet : utiliser letteringCode en priorite, sinon lettrage
      const ecritureLet = line.letteringCode
        ? sanitize(line.letteringCode)
        : line.lettrage
          ? sanitize(line.lettrage)
          : "";
      // DateLet : date du lettrage si disponible
      const dateLet = line.letteredAt ? fmtDate(line.letteredAt) : "";

      // Tier auxiliaire (DGFiP CompAuxNum / CompAuxLib) : renseigné si la ligne
      // est rattachée à un Proprietaire (usufruitier / nu-propriétaire en
      // démembrement par exemple). Format AUX-XXXXXXXX (8 premiers caractères
      // du CUID, en majuscules).
      const auxCode = line.auxiliaryProprietaire
        ? "AUX-" + line.auxiliaryProprietaire.id.slice(0, 8).toUpperCase()
        : "";
      const auxLib = line.auxiliaryProprietaire
        ? sanitize(line.auxiliaryProprietaire.label)
        : "";

      rows.push([
        journalCode,
        sanitize(journalLib),
        ecritureNum,
        fmtDate(entry.entryDate),
        sanitize(line.account.code),
        sanitize(line.account.label),
        auxCode,
        auxLib,
        pieceRef,
        pieceDate,
        lineLabel,
        fmtAmount(line.debit),
        fmtAmount(line.credit),
        ecritureLet,
        dateLet,
        validDate,
        "", // Montantdevise
        "", // Idevise
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

  // Nom du fichier : {SIREN}FEC{YYYYMMDD}.txt
  // YYYYMMDD = date de cloture de l exercice fiscal
  let closingDate: string;
  if (fiscalYear) {
    closingDate = fmtDate(fiscalYear.endDate);
  } else if (options.year) {
    closingDate = `${options.year}1231`;
  } else {
    closingDate = fmtDate(new Date());
  }
  const filename = `${siren}FEC${closingDate}.txt`;

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
