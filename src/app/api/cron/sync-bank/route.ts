import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { syncAccountTransactionsInternal } from "@/actions/bank-connection";

/**
 * Route CRON : synchronise automatiquement les transactions de tous les comptes
 * Open Banking actifs de toutes les societes.
 *
 * Planifie via Vercel Cron (vercel.json) :
 * { "crons": [{ "path": "/api/cron/sync-bank", "schedule": "0 6 * * *" }] }
 *
 * Protegee par le header Authorization: Bearer CRON_SECRET
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== "Bearer " + cronSecret) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  // Recuperer tous les comptes Powens actifs
  const accounts = await prisma.bankAccount.findMany({
    where: {
      powensAccountId: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      societyId: true,
      powensAccountId: true,
      connection: {
        select: { powensUserId: true, powensAccessToken: true, status: true },
      },
    },
  });

  let totalImported = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    if (!account.powensAccountId) continue;
    if (!account.connection || account.connection.status !== "active") continue;
    if (!account.connection.powensAccessToken || !account.connection.powensUserId) continue;

    try {
      const userToken = decrypt(account.connection.powensAccessToken);
      const userId = parseInt(account.connection.powensUserId, 10);
      const powensAccountId = parseInt(account.powensAccountId, 10);

      const imported = await syncAccountTransactionsInternal(
        account.societyId,
        account.id,
        powensAccountId,
        userId,
        userToken
      );
      totalImported += imported;
    } catch (error) {
      const msg = "Compte " + account.id + ": " + (error instanceof Error ? error.message : "Erreur inconnue");
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
