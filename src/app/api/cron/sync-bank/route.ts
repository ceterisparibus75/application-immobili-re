import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import {
  syncAccountTransactionsInternal,
  syncQontoTransactionsInternal,
} from "@/actions/bank-connection";

/**
 * Route CRON : synchronise automatiquement les transactions de tous les comptes
 * bancaires connectés (Powens + Qonto) de toutes les sociétés.
 *
 * Planifié via Vercel Cron (vercel.json) :
 * { "crons": [{ "path": "/api/cron/sync-bank", "schedule": "0 6 * * *" }] }
 *
 * Protégée par le header Authorization: Bearer CRON_SECRET
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== "Bearer " + cronSecret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let totalImported = 0;
  const errors: string[] = [];
  let accountsSynced = 0;

  // ─── Powens ────────────────────────────────────────────────────────────────

  const powensAccounts = await prisma.bankAccount.findMany({
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

  for (const account of powensAccounts) {
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
      accountsSynced++;
    } catch (error) {
      const msg = "Powens " + account.id + ": " + (error instanceof Error ? error.message : "Erreur inconnue");
      errors.push(msg);
      console.error("[cron/sync-bank]", msg);
    }
  }

  // ─── Qonto ─────────────────────────────────────────────────────────────────

  const qontoAccounts = await prisma.bankAccount.findMany({
    where: {
      qontoAccountId: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      societyId: true,
      qontoAccountId: true,
      connection: {
        select: {
          provider: true,
          qontoSlugEncrypted: true,
          qontoSecretKeyEncrypted: true,
          status: true,
        },
      },
    },
  });

  for (const account of qontoAccounts) {
    if (!account.qontoAccountId) continue;
    if (!account.connection || account.connection.status !== "active") continue;
    if (!account.connection.qontoSlugEncrypted || !account.connection.qontoSecretKeyEncrypted) continue;

    try {
      const slug = decrypt(account.connection.qontoSlugEncrypted);
      const secretKey = decrypt(account.connection.qontoSecretKeyEncrypted);

      const imported = await syncQontoTransactionsInternal(
        account.societyId,
        account.id,
        account.qontoAccountId,
        slug,
        secretKey
      );
      totalImported += imported;
      accountsSynced++;
    } catch (error) {
      const msg = "Qonto " + account.id + ": " + (error instanceof Error ? error.message : "Erreur inconnue");
      errors.push(msg);
      console.error("[cron/sync-bank]", msg);
    }
  }

  return NextResponse.json({
    success: true,
    accountsSynced,
    transactionsImported: totalImported,
    errors: errors.length > 0 ? errors : undefined,
  });
}
