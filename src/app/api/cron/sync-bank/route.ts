import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncAccountTransactionsInternal } from "@/actions/bank-connection";

/**
 * Route CRON : synchronise automatiquement les transactions de tous les comptes
 * Open Banking actifs de toutes les sociétés.
 *
 * À planifier via Vercel Cron (vercel.json) :
 * { "crons": [{ "path": "/api/cron/sync-bank", "schedule": "0 6 * * *" }] }
 *
 * Protégée par le header Authorization: Bearer CRON_SECRET
 */
export async function POST(request: Request) {
  // Vérification du secret CRON
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Récupérer tous les comptes GoCardless actifs
  const accounts = await prisma.bankAccount.findMany({
    where: {
      gocardlessAccountId: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      societyId: true,
      gocardlessAccountId: true,
    },
  });

  let totalImported = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    if (!account.gocardlessAccountId) continue;
    try {
      const imported = await syncAccountTransactionsInternal(
        account.societyId,
        account.id,
        account.gocardlessAccountId
      );
      totalImported += imported;
    } catch (error) {
      const msg = `Compte ${account.id}: ${error instanceof Error ? error.message : "Erreur inconnue"}`;
      errors.push(msg);
      console.error("[cron/sync-bank]", msg);
    }
  }

  return NextResponse.json({
    success: true,
    accountsSynced: accounts.length,
    transactionsImported: totalImported,
    errors: errors.length > 0 ? errors : undefined,
  });
}
