import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { generateFec } from "@/lib/fec-export";
import { createAuditLog } from "@/lib/audit";
import { isAccountingJournalType } from "@/lib/accounting-journals";
import type { JournalType } from "@/generated/prisma/client";

function parseJournalType(value: unknown): JournalType | undefined {
  return typeof value === "string" && isAccountingJournalType(value)
    ? (value as JournalType)
    : undefined;
}

// GET - Telechargement du fichier FEC
export async function GET(req: NextRequest) {
  const context = await requireActiveSocietyRouteContext({ minRole: "COMPTABLE" });
  if (context instanceof NextResponse) return context;

  const p = req.nextUrl.searchParams;
  const fiscalYearId = p.get("fiscalYearId");
  const yearStr = p.get("year");
  const journalStr = p.get("journal");

  const options: Parameters<typeof generateFec>[1] = {};

  // Priorite au fiscalYearId s'il est fourni
  if (fiscalYearId) {
    options.fiscalYearId = fiscalYearId;
  } else if (yearStr) {
    const y = parseInt(yearStr, 10);
    if (!isNaN(y) && y >= 2000 && y <= 2100) options.year = y;
  }

  options.journalType = parseJournalType(journalStr);
  if (p.get("validatedOnly") === "true") options.validatedOnly = true;

  const result = await generateFec(context.societyId, options);
  const hasErrors = result.anomalies.some((anomaly) => anomaly.severity === "error");
  if (hasErrors) {
    return NextResponse.json(
      {
        error: "Export FEC bloqué : corrigez les anomalies avant téléchargement",
        anomalies: result.anomalies,
        stats: result.stats,
      },
      { status: 422 }
    );
  }

  await createAuditLog({
    societyId: context.societyId,
    userId: context.userId,
    action: "EXPORT",
    entity: "JournalEntry",
    entityId: context.societyId,
    details: { format: "FEC", fiscalYearId, year: yearStr, lineCount: result.lineCount },
  });

  // BOM UTF-8 + contenu TSV
  const bom = "﻿";
  const body = bom + result.content;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}

// POST - Validation sans telechargement
export async function POST(req: NextRequest) {
  const context = await requireActiveSocietyRouteContext({ minRole: "COMPTABLE" });
  if (context instanceof NextResponse) return context;

  const body = await req.json().catch(() => ({}));
  const { year, journalType, validatedOnly, fiscalYearId } = body as Record<string, unknown>;

  const result = await generateFec(context.societyId, {
    fiscalYearId: typeof fiscalYearId === "string" ? fiscalYearId : undefined,
    year: typeof year === "string" ? parseInt(year, 10) : undefined,
    journalType: parseJournalType(journalType),
    validatedOnly: validatedOnly === true,
  });

  return NextResponse.json({
    lineCount: result.lineCount,
    anomalies: result.anomalies,
    stats: result.stats,
    filename: result.filename,
  });
}
