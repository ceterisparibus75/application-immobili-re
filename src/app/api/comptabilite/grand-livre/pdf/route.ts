import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { GrandLivrePdf } from "@/lib/grand-livre-pdf";
import {
  grandLivreExportFilename,
  type GrandLivreExportPayload,
  type GrandLivreExportRow,
} from "@/lib/grand-livre-export";

function isExportRow(value: unknown): value is GrandLivreExportRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.accountCode === "string" &&
    typeof row.accountLabel === "string" &&
    (typeof row.date === "string" || row.date instanceof Date) &&
    (typeof row.piece === "string" || row.piece === null) &&
    typeof row.journalType === "string" &&
    typeof row.label === "string" &&
    typeof row.debit === "number" &&
    typeof row.credit === "number" &&
    typeof row.solde === "number" &&
    (typeof row.lettrage === "string" || row.lettrage === null) &&
    typeof row.status === "string"
  );
}

function parsePayload(body: unknown): GrandLivreExportPayload | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;
  if (typeof payload.societyName !== "string") return null;
  if (typeof payload.periodLabel !== "string") return null;
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) return null;
  if (!payload.rows.every(isExportRow)) return null;
  return {
    societyName: payload.societyName,
    periodLabel: payload.periodLabel,
    rows: payload.rows,
  };
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (context instanceof NextResponse) return context;

    const payload = parsePayload(await req.json());
    if (!payload) {
      return NextResponse.json(
        { error: { code: "INVALID_PAYLOAD", message: "Données du grand livre invalides" } },
        { status: 400 }
      );
    }

    const buffer = await renderToBuffer(
      React.createElement(GrandLivrePdf, { data: payload }) as never
    );
    const filename = grandLivreExportFilename("pdf");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[grand-livre-pdf]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Erreur lors de la génération du PDF" } },
      { status: 500 }
    );
  }
}
