import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isEInvoicingConfigured } from "@/lib/pa-client";
import { _syncForSociety } from "@/actions/einvoicing";

/**
 * Route CRON : synchronise les factures électroniques reçues depuis la PA partenaire
 * pour toutes les sociétés inscrites à l'Annuaire PPF.
 *
 * Planifié via Vercel Cron (vercel.json) :
 * { "path": "/api/cron/sync-einvoices", "schedule": "0 * * * *" }
 * (Toutes les heures)
 *
 * Protégée par Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = env.CRON_SECRET;

  if (!cronSecret || authHeader !== "Bearer " + cronSecret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!isEInvoicingConfigured()) {
    return NextResponse.json(
      { message: "Facturation électronique non configurée — cron ignoré" },
      { status: 200 }
    );
  }

  // Toutes les sociétés inscrites à l'annuaire PPF avec un SIRET
  const societies = await prisma.society.findMany({
    where: {
      ppfRegisteredAt: { not: null },
      siret: { not: null },
      isActive: true,
    },
    select: { id: true, name: true, siret: true },
  });

  const summary: Array<{
    societyId: string;
    name: string;
    created: number;
    updated: number;
    error?: string;
  }> = [];

  for (const society of societies) {
    try {
      const result = await _syncForSociety(society.id, society.siret!);
      summary.push({
        societyId: society.id,
        name: society.name,
        created: result.data?.created ?? 0,
        updated: result.data?.updated ?? 0,
        ...(result.success ? {} : { error: result.error }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sync-einvoices] Société ${society.name}:`, err);
      summary.push({ societyId: society.id, name: society.name, created: 0, updated: 0, error: message });
    }
  }

  const totalCreated = summary.reduce((s, r) => s + r.created, 0);
  const totalUpdated = summary.reduce((s, r) => s + r.updated, 0);
  const errors = summary.filter((r) => r.error);

  if (errors.length > 0) {
    console.error("[sync-einvoices]", {
      societies: societies.length,
      created: totalCreated,
      updated: totalUpdated,
      errors: errors.length,
    });
  }

  return NextResponse.json({ societies: societies.length, created: totalCreated, updated: totalUpdated, errors: errors.length, summary });
}
