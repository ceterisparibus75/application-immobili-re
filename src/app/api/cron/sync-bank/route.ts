import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import {
  syncAccountTransactionsInternal,
  syncQontoTransactionsInternal,
} from "@/actions/bank-connection";
import { getPowensConnectionsStatus } from "@/lib/powens";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * États Powens qui exigent une nouvelle authentification forte avant la
 * prochaine synchronisation : la connexion est encore là côté Powens mais
 * la banque ne nous laissera pas lire les opérations tant que l'utilisateur
 * n'est pas repassé par la webview.
 */
const POWENS_STATES_REQUIRING_RENEWAL = new Set<string>([
  "SCARequired",
  "webauthRequired",
  "additionalInformationNeeded",
  "decoupled",
  "validating",
  "wrongpass",
  "actionNeeded",
  "websiteUnavailable",
  "bug",
]);

// Vercel Pro : 300s de budget côté runtime. Permet d'absorber la pagination
// Powens (jusqu'à 20 000 tx) × plusieurs sociétés sans coupure.
export const maxDuration = 300;

/**
 * Route CRON : synchronise automatiquement les transactions de tous les comptes
 * bancaires connectés (Powens + Qonto) de toutes les sociétés.
 *
 * Planifié via Vercel Cron (vercel.json) :
 * { "crons": [{ "path": "/api/cron/sync-bank", "schedule": "0 6 * * *" }] }
 *
 * Protégée par le header Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!verifyCronSecret(authHeader)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let totalImported = 0;
  const errors: string[] = [];
  let accountsSynced = 0;
  let connectionsExpiredByState = 0;

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
      connectionId: true,
      connection: {
        select: {
          id: true,
          powensUserId: true,
          powensAccessToken: true,
          powensConnectionId: true,
          status: true,
        },
      },
    },
  });

  // Pré-check de l'état Powens, une fois par connexion (point 7). On lit
  // /users/{id}/connections, et si une connexion est en SCARequired, wrongpass
  // etc. on la passe en "expired" + on skip tous ses comptes. Évite d'épuiser
  // le crédit API en appelant /transactions sur un token qui ne retournera
  // de toute façon rien.
  const powensDegraded = new Set<string>(); // connection.id (BDD) à ne pas synchroniser

  // Groupe les comptes par connexion : une seule lecture /connections par user
  const byConnection = new Map<string, {
    userToken: string;
    userId: number;
    connectionIdBdd: string;
    powensConnectionId: string | null;
  }>();
  for (const account of powensAccounts) {
    if (!account.connection) continue;
    if (!account.connection.powensAccessToken || !account.connection.powensUserId) continue;
    if (byConnection.has(account.connection.id)) continue;
    try {
      byConnection.set(account.connection.id, {
        userToken: decrypt(account.connection.powensAccessToken),
        userId: parseInt(account.connection.powensUserId, 10),
        connectionIdBdd: account.connection.id,
        powensConnectionId: account.connection.powensConnectionId,
      });
    } catch {
      // token illisible — sera signalé lors de la sync
    }
  }

  for (const entry of byConnection.values()) {
    try {
      const states = await getPowensConnectionsStatus(entry.userId, entry.userToken);
      let needsRenewal = false;
      let detectedState: string | null = null;

      // Si on a un powensConnectionId, cible-le ; sinon, dès qu'une des
      // connexions de l'user est en état dégradé on le signale.
      const target = entry.powensConnectionId
        ? states.find((s) => String(s.id) === entry.powensConnectionId)
        : states[0];
      if (target?.state && POWENS_STATES_REQUIRING_RENEWAL.has(target.state)) {
        needsRenewal = true;
        detectedState = target.state;
      }
      if (needsRenewal) {
        await prisma.bankConnection.update({
          where: { id: entry.connectionIdBdd },
          data: { status: "expired" },
        });
        powensDegraded.add(entry.connectionIdBdd);
        connectionsExpiredByState++;
        console.warn(
          `[cron/sync-bank] connexion ${entry.connectionIdBdd} marquée expired (state Powens: ${detectedState})`
        );
      }
    } catch (error) {
      // Si le /connections lui-même échoue en 401/403, le token est mort.
      const msg = error instanceof Error ? error.message : String(error);
      if (/\((401|403)\)/.test(msg)) {
        await prisma.bankConnection.update({
          where: { id: entry.connectionIdBdd },
          data: { status: "expired" },
        }).catch(() => undefined);
        powensDegraded.add(entry.connectionIdBdd);
        connectionsExpiredByState++;
      } else {
        errors.push("Powens state check " + entry.connectionIdBdd + ": " + msg);
      }
    }
  }

  for (const account of powensAccounts) {
    if (!account.powensAccountId) continue;
    if (!account.connection || account.connection.status !== "active") continue;
    if (!account.connection.powensAccessToken || !account.connection.powensUserId) continue;
    if (powensDegraded.has(account.connection.id)) continue;

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
    connectionsExpiredByState,
    errors: errors.length > 0 ? errors : undefined,
  });
}
