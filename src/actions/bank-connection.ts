"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/encryption";
import {
  initPowensUser,
  getPowensWebviewCode,
  buildPowensWebviewUrl,
  getPowensUserAccounts,
  getPowensTransactions,
  getPowensConnectors,
  type PowensConnector,
} from "@/lib/powens";
import {
  getQontoOrganization,
  getQontoTransactions,
} from "@/lib/qonto";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { applyAutoTag } from "@/actions/cashflow";

// ─── Liste des connecteurs (banques disponibles) ─────────────────────────────

export async function getGocardlessInstitutions(
  societyId: string
): Promise<ActionResult<PowensConnector[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
    const connectors = await getPowensConnectors();
    return { success: true, data: connectors };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getConnectors]", error);
    return { success: false, error: "Impossible de récupérer la liste des banques" };
  }
}

// ─── Initier une connexion Open Banking ─────────────────────────────────────

export async function initiateOpenBanking(
  societyId: string,
  connectorId: string,
  connectorName: string
): Promise<ActionResult<{ authLink: string; connectionId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";
    const redirectUrl = appUrl + "/api/banque/callback";

    const { auth_token, id_user } = await initPowensUser();

    // Chiffrer et stocker immediatement le token permanent
    const encryptedToken = encrypt(auth_token);

    const connection = await prisma.bankConnection.create({
      data: {
        societyId,
        powensUserId: String(id_user),
        connectorId,
        institutionName: connectorName,
        status: "pending",
        powensAccessToken: encryptedToken,
      },
    });

    const code = await getPowensWebviewCode(auth_token);

    const webviewUrl = buildPowensWebviewUrl({
      code,
      state: connection.id,
      redirectUri: redirectUrl,
      connectorId: parseInt(connectorId, 10) || undefined,
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "BankConnection",
      entityId: connection.id,
      details: { connectorId, connectorName },
    });

    // eslint-disable-next-line no-console
    console.log("[initiateOpenBanking] webviewUrl:", webviewUrl);
    return { success: true, data: { authLink: webviewUrl, connectionId: connection.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[initiateOpenBanking]", error);
    return { success: false, error: "Erreur lors de la connexion bancaire" };
  }
}


// syncOpenBankingAccounts
export async function syncOpenBankingAccounts(
  societyId: string,
  connectionId: string
): Promise<ActionResult<{ synced: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
    const connection = await prisma.bankConnection.findFirst({ where: { id: connectionId, societyId } });
    if (!connection) return { success: false, error: "Connexion introuvable" };
    if (connection.status !== "active")
      return { success: false, error: "Connexion non autorisee (statut: " + connection.status + ")" };
    if (!connection.powensAccessToken || !connection.powensUserId)
      return { success: false, error: "Token Powens manquant" };
    const userToken = decrypt(connection.powensAccessToken);
    const userId = parseInt(connection.powensUserId, 10);
    const accounts = await getPowensUserAccounts(userId, userToken);
    let synced = 0;
    for (const account of accounts) {
      if (account.disabled) continue;
      const existing = await prisma.bankAccount.findFirst({ where: { powensAccountId: String(account.id), societyId } });
      let bankAccountId: string;
      if (existing) {
        bankAccountId = existing.id;
      } else {
        const created = await prisma.bankAccount.create({ data: {
          societyId, bankName: connection.institutionName, accountName: account.name ?? "Compte",
          ibanEncrypted: encrypt(account.iban ?? "IBAN_NON_DISPONIBLE"),
          initialBalance: account.balance ?? 0, currentBalance: account.balance ?? 0,
          powensAccountId: String(account.id), connectionId,
        } });
        bankAccountId = created.id;
        await createAuditLog({ societyId, userId: session.user.id, action: "CREATE",
          entity: "BankAccount", entityId: bankAccountId,
          details: { bankName: connection.institutionName, powensAccountId: account.id } });
      }
      await syncAccountTransactionsInternal(societyId, bankAccountId, account.id, userId, userToken);
      synced++;
    }
    revalidatePath("/banque");
    revalidatePath("/comptabilite/cashflow");
    return { success: true, data: { synced } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[syncOpenBankingAccounts]", msg);
    return { success: false, error: msg };
  }
}

// syncAllAccounts — synchronise tous les comptes bancaires de la société
export type SyncAccountDetail = {
  accountName: string;
  provider: string;
  imported: number;
  status: "ok" | "error" | "skipped";
  error?: string;
  lastSyncAt: string | null;
  oldestTransaction: string | null;
  newestTransaction: string | null;
};

export type SyncAllResult = {
  totalImported: number;
  accountsSynced: number;
  accountsFailed: number;
  details: SyncAccountDetail[];
  dateWarning: string | null;
};

export async function syncAllAccounts(
  societyId: string
): Promise<ActionResult<SyncAllResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const accounts = await prisma.bankAccount.findMany({
      where: { societyId },
      include: {
        connection: {
          select: {
            provider: true, powensUserId: true, powensAccessToken: true,
            qontoSlugEncrypted: true, qontoSecretKeyEncrypted: true,
          },
        },
      },
    });

    let totalImported = 0;
    let accountsSynced = 0;
    let accountsFailed = 0;
    const details: SyncAccountDetail[] = [];

    for (const account of accounts) {
      const detail: SyncAccountDetail = {
        accountName: account.accountName,
        provider: account.qontoAccountId ? "Qonto" : account.powensAccountId ? "Powens" : "Manuel",
        imported: 0,
        status: "skipped",
        lastSyncAt: null,
        oldestTransaction: null,
        newestTransaction: null,
      };

      try {
        let imported = 0;
        if (account.qontoAccountId && account.connection?.provider === "QONTO") {
          if (!account.connection.qontoSlugEncrypted || !account.connection.qontoSecretKeyEncrypted) {
            detail.status = "skipped";
            detail.error = "Identifiants Qonto manquants";
            details.push(detail);
            continue;
          }
          const slug = decrypt(account.connection.qontoSlugEncrypted);
          const secretKey = decrypt(account.connection.qontoSecretKeyEncrypted);
          imported = await syncQontoTransactionsInternal(societyId, account.id, account.qontoAccountId, slug, secretKey);
        } else if (account.powensAccountId) {
          if (!account.connection?.powensAccessToken || !account.connection.powensUserId) {
            detail.status = "skipped";
            detail.error = "Token Powens manquant";
            details.push(detail);
            continue;
          }
          const userToken = decrypt(account.connection.powensAccessToken);
          const userId = parseInt(account.connection.powensUserId, 10);
          const powensAccountId = parseInt(account.powensAccountId, 10);
          imported = await syncAccountTransactionsInternal(societyId, account.id, powensAccountId, userId, userToken);
        } else {
          details.push(detail);
          continue;
        }
        detail.imported = imported;
        detail.status = "ok";
        totalImported += imported;
        accountsSynced++;
      } catch (e) {
        console.error(`[syncAllAccounts] Erreur compte ${account.id}:`, e);
        detail.status = "error";
        detail.error = e instanceof Error ? e.message : "Erreur inconnue";
        accountsFailed++;
      }

      // Récupérer les bornes temporelles du compte après sync
      const updatedAccount = await prisma.bankAccount.findUnique({
        where: { id: account.id },
        select: { lastSyncAt: true },
      });
      detail.lastSyncAt = updatedAccount?.lastSyncAt?.toISOString() ?? null;

      const [oldest, newest] = await Promise.all([
        prisma.bankTransaction.findFirst({
          where: { bankAccountId: account.id },
          orderBy: { transactionDate: "asc" },
          select: { transactionDate: true },
        }),
        prisma.bankTransaction.findFirst({
          where: { bankAccountId: account.id },
          orderBy: { transactionDate: "desc" },
          select: { transactionDate: true },
        }),
      ]);
      detail.oldestTransaction = oldest?.transactionDate?.toISOString() ?? null;
      detail.newestTransaction = newest?.transactionDate?.toISOString() ?? null;
      details.push(detail);
    }

    // ── Vérification cohérence des dates ─────────────────────────────
    // Si les comptes connectés ont des plages de dates très différentes,
    // cela peut fausser le cash flow (un compte a 3 mois d'historique,
    // un autre seulement 2 semaines)
    let dateWarning: string | null = null;
    const connectedDetails = details.filter((d) => d.status === "ok" && d.oldestTransaction);
    if (connectedDetails.length >= 2) {
      const oldestDates = connectedDetails.map((d) => new Date(d.oldestTransaction!).getTime());
      const newestDates = connectedDetails.map((d) => new Date(d.newestTransaction!).getTime());
      const maxOldestGap = Math.max(...oldestDates) - Math.min(...oldestDates);
      const maxNewestGap = Math.max(...newestDates) - Math.min(...newestDates);
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

      if (maxOldestGap > THIRTY_DAYS) {
        const earlyAccount = connectedDetails.find(
          (d) => new Date(d.oldestTransaction!).getTime() === Math.min(...oldestDates)
        );
        const lateAccount = connectedDetails.find(
          (d) => new Date(d.oldestTransaction!).getTime() === Math.max(...oldestDates)
        );
        const gapDays = Math.round(maxOldestGap / (24 * 60 * 60 * 1000));
        dateWarning = `Écart de ${gapDays} jours entre les historiques : « ${earlyAccount?.accountName} » remonte au ${fmtDate(earlyAccount!.oldestTransaction!)} tandis que « ${lateAccount?.accountName} » commence au ${fmtDate(lateAccount!.oldestTransaction!)}. Importez un relevé CSV pour compléter l'historique manquant.`;
      } else if (maxNewestGap > SEVEN_DAYS) {
        const freshAccount = connectedDetails.find(
          (d) => new Date(d.newestTransaction!).getTime() === Math.max(...newestDates)
        );
        const staleAccount = connectedDetails.find(
          (d) => new Date(d.newestTransaction!).getTime() === Math.min(...newestDates)
        );
        const gapDays = Math.round(maxNewestGap / (24 * 60 * 60 * 1000));
        dateWarning = `« ${staleAccount?.accountName} » a ${gapDays} jour(s) de retard par rapport à « ${freshAccount?.accountName} ». Vérifiez la connexion bancaire de ce compte.`;
      }
    }

    revalidatePath("/banque");
    revalidatePath("/comptabilite/cashflow");
    return {
      success: true,
      data: { totalImported, accountsSynced, accountsFailed, details, dateWarning },
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[syncAllAccounts]", error);
    return { success: false, error: "Erreur lors de la synchronisation" };
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// syncAccountTransactions (appel UI — détecte automatiquement Powens ou Qonto)
export async function syncAccountTransactions(
  societyId: string,
  bankAccountId: string
): Promise<ActionResult<{ imported: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, societyId },
      include: {
        connection: {
          select: {
            provider: true,
            powensUserId: true,
            powensAccessToken: true,
            qontoSlugEncrypted: true,
            qontoSecretKeyEncrypted: true,
          },
        },
      },
    });
    if (!account) return { success: false, error: "Compte introuvable" };

    let imported: number;

    // Qonto
    if (account.qontoAccountId && account.connection?.provider === "QONTO") {
      if (!account.connection.qontoSlugEncrypted || !account.connection.qontoSecretKeyEncrypted) {
        return { success: false, error: "Identifiants Qonto manquants" };
      }
      const slug = decrypt(account.connection.qontoSlugEncrypted);
      const secretKey = decrypt(account.connection.qontoSecretKeyEncrypted);
      imported = await syncQontoTransactionsInternal(
        societyId, bankAccountId, account.qontoAccountId, slug, secretKey
      );
    }
    // Powens
    else if (account.powensAccountId) {
      if (!account.connection?.powensAccessToken || !account.connection.powensUserId) {
        return { success: false, error: "Token Powens manquant" };
      }
      const userToken = decrypt(account.connection.powensAccessToken);
      const userId = parseInt(account.connection.powensUserId, 10);
      const powensAccountId = parseInt(account.powensAccountId, 10);
      imported = await syncAccountTransactionsInternal(
        societyId, bankAccountId, powensAccountId, userId, userToken
      );
    } else {
      return { success: false, error: "Compte non lié à un service bancaire" };
    }

    revalidatePath("/banque");
    revalidatePath("/banque/" + bankAccountId);
    revalidatePath("/comptabilite/cashflow");
    return { success: true, data: { imported } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[syncAccountTransactions]", errMsg);

    // Erreurs Powens courantes
    if (errMsg.includes("403") || errMsg.includes("401")) {
      return { success: false, error: "Connexion bancaire expirée. Veuillez reconnecter votre compte via Open Banking." };
    }
    if (errMsg.includes("429")) {
      return { success: false, error: "Trop de requêtes. Réessayez dans quelques minutes." };
    }
    if (errMsg.includes("fetch") || errMsg.includes("ECONNREFUSED") || errMsg.includes("network")) {
      return { success: false, error: "Impossible de joindre le service bancaire. Réessayez plus tard." };
    }
    return { success: false, error: `Erreur de synchronisation : ${errMsg}` };
  }
}

// syncAccountTransactionsInternal (partage avec le cron)
export async function syncAccountTransactionsInternal(
  societyId: string,
  bankAccountId: string,
  powensAccountId: number,
  userId: number,
  userToken: string
): Promise<number> {
  const row = await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { lastSyncAt: true } });
  const isFirstSync = !row?.lastSyncAt;

  // Toujours remonter 7 jours avant lastSyncAt pour rattraper les transactions manquées
  // Les doublons sont filtrés via externalId
  let dateFrom: string;
  if (row?.lastSyncAt) {
    const bufferDate = new Date(row.lastSyncAt);
    bufferDate.setDate(bufferDate.getDate() - 7);
    dateFrom = bufferDate.toISOString().split("T")[0];
  } else {
    dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }

  const transactions = await getPowensTransactions(userId, powensAccountId, userToken, dateFrom);
  let imported = 0;
  let balanceDelta = 0;
  for (const tx of transactions) {
    const externalId = String(tx.id);
    const dup = await prisma.bankTransaction.findFirst({ where: { bankAccountId, externalId } });
    if (dup) continue;
    const amount = tx.value;
    const label = tx.simplified_wording ?? tx.label ?? tx.original_wording ?? "Transaction";
    // Auto-tag : catégoriser automatiquement si le libellé est connu
    const autoCategory = await applyAutoTag(societyId, label);
    await prisma.bankTransaction.create({ data: {
      bankAccountId, transactionDate: new Date(tx.date),
      valueDate: tx.value_date ? new Date(tx.value_date) : null,
      amount, label, reference: externalId, externalId,
      category: autoCategory,
      importBatch: "sync-" + String(Date.now()),
    } });
    balanceDelta += amount;
    imported++;
  }
  if (isFirstSync && imported > 0) {
    // Première sync : le solde Powens (currentBalance) inclut déjà ces transactions.
    // On ajuste initialBalance pour que initialBalance + somme_transactions = currentBalance.
    const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { currentBalance: true } });
    const correctInitial = (account?.currentBalance ?? 0) - balanceDelta;
    await prisma.bankAccount.update({ where: { id: bankAccountId }, data: {
      initialBalance: correctInitial,
      lastSyncAt: new Date(),
    } });
  } else if (imported > 0) {
    // Syncs suivantes avec nouvelles transactions : maj solde + date
    await prisma.bankAccount.update({ where: { id: bankAccountId }, data: {
      currentBalance: { increment: balanceDelta },
      lastSyncAt: new Date(),
    } });
  }
  // Si 0 transactions importées, on ne met PAS à jour lastSyncAt
  // pour ne pas perdre la fenêtre de rattrapage
  await prisma.auditLog.create({ data: {
    societyId, action: "CREATE", entity: "BankTransaction", entityId: bankAccountId,
    details: { imported, source: "powens_sync", isFirstSync },
  } });
  return imported;
}

// ─── Qonto : connexion directe ──────────────────────────────────────────────

export async function connectQonto(
  societyId: string,
  qontoSlug: string,
  qontoSecretKey: string
): Promise<ActionResult<{ connectionId: string; accountsCreated: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    if (!qontoSlug.trim() || !qontoSecretKey.trim()) {
      return { success: false, error: "Le slug et la clé secrète Qonto sont requis" };
    }

    // Vérifier les identifiants en appelant l'API
    const org = await getQontoOrganization(qontoSlug, qontoSecretKey);

    // Créer la connexion
    const connection = await prisma.bankConnection.create({
      data: {
        societyId,
        provider: "QONTO",
        institutionName: "Qonto — " + org.legal_name,
        status: "active",
        qontoSlugEncrypted: encrypt(qontoSlug),
        qontoSecretKeyEncrypted: encrypt(qontoSecretKey),
      },
    });

    // Créer les comptes bancaires
    let accountsCreated = 0;
    for (const account of org.bank_accounts) {
      if (account.status !== "active") continue;

      const existing = await prisma.bankAccount.findFirst({
        where: { qontoAccountId: account.slug, societyId },
      });
      if (existing) continue;

      const bankAccount = await prisma.bankAccount.create({
        data: {
          societyId,
          bankName: "Qonto",
          accountName: account.name || "Compte Qonto",
          ibanEncrypted: encrypt(account.iban),
          initialBalance: account.balance,
          currentBalance: account.balance,
          qontoAccountId: account.slug,
          connectionId: connection.id,
        },
      });

      await createAuditLog({
        societyId,
        userId: session.user.id,
        action: "CREATE",
        entity: "BankAccount",
        entityId: bankAccount.id,
        details: { bankName: "Qonto", qontoAccountSlug: account.slug },
      });
      accountsCreated++;
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "BankConnection",
      entityId: connection.id,
      details: { provider: "QONTO", legalName: org.legal_name, accountsCreated },
    });

    revalidatePath("/banque");
    return { success: true, data: { connectionId: connection.id, accountsCreated } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[connectQonto]", msg);
    if (msg.includes("401")) {
      return { success: false, error: "Identifiants Qonto invalides. Vérifiez le slug et la clé secrète." };
    }
    return { success: false, error: "Erreur lors de la connexion Qonto : " + msg };
  }
}

// syncQontoAccountTransactions (appel UI — un seul compte)
export async function syncQontoAccountTransactions(
  societyId: string,
  bankAccountId: string
): Promise<ActionResult<{ imported: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, societyId },
      include: {
        connection: {
          select: {
            provider: true,
            qontoSlugEncrypted: true,
            qontoSecretKeyEncrypted: true,
          },
        },
      },
    });
    if (!account) return { success: false, error: "Compte introuvable" };
    if (!account.qontoAccountId) return { success: false, error: "Compte non lié à Qonto" };
    if (!account.connection?.qontoSlugEncrypted || !account.connection.qontoSecretKeyEncrypted) {
      return { success: false, error: "Identifiants Qonto manquants" };
    }

    const slug = decrypt(account.connection.qontoSlugEncrypted);
    const secretKey = decrypt(account.connection.qontoSecretKeyEncrypted);

    const imported = await syncQontoTransactionsInternal(
      societyId,
      bankAccountId,
      account.qontoAccountId,
      slug,
      secretKey
    );

    revalidatePath("/banque");
    revalidatePath("/banque/" + bankAccountId);
    revalidatePath("/comptabilite/cashflow");
    return { success: true, data: { imported } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[syncQontoAccountTransactions]", error);
    return { success: false, error: "Erreur sync transactions Qonto" };
  }
}

// syncQontoTransactionsInternal (partagé avec le cron)
export async function syncQontoTransactionsInternal(
  societyId: string,
  bankAccountId: string,
  qontoAccountSlug: string,
  slug: string,
  secretKey: string
): Promise<number> {
  const row = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { lastSyncAt: true },
  });
  const isFirstSync = !row?.lastSyncAt;
  const dateFrom = row?.lastSyncAt
    ? row.lastSyncAt.toISOString()
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const transactions = await getQontoTransactions(slug, secretKey, qontoAccountSlug, dateFrom);

  let imported = 0;
  let balanceDelta = 0;

  for (const tx of transactions) {
    if (!tx.settled_at) continue; // Ignorer les transactions non réglées

    const externalId = tx.transaction_id;
    const dup = await prisma.bankTransaction.findFirst({
      where: { bankAccountId, externalId },
    });
    if (dup) continue;

    const amount = tx.side === "debit" ? -Math.abs(tx.amount) : Math.abs(tx.amount);
    const label = tx.label || "Transaction Qonto";
    // Auto-tag : catégoriser automatiquement si le libellé est connu
    const autoCategory = await applyAutoTag(societyId, label);

    await prisma.bankTransaction.create({
      data: {
        bankAccountId,
        transactionDate: new Date(tx.settled_at),
        valueDate: tx.emitted_at ? new Date(tx.emitted_at) : null,
        amount,
        label,
        reference: tx.reference || externalId,
        category: tx.category || autoCategory,
        externalId,
        importBatch: "qonto-sync-" + String(Date.now()),
      },
    });
    balanceDelta += amount;
    imported++;
  }

  if (isFirstSync && imported > 0) {
    // Première sync : ajuster le solde initial
    const acct = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { currentBalance: true },
    });
    const correctInitial = (acct?.currentBalance ?? 0) - balanceDelta;
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { initialBalance: correctInitial, lastSyncAt: new Date() },
    });
  } else {
    // Syncs suivantes : incrémenter le solde
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        ...(balanceDelta !== 0 ? { currentBalance: { increment: balanceDelta } } : {}),
        lastSyncAt: new Date(),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      societyId,
      action: "CREATE",
      entity: "BankTransaction",
      entityId: bankAccountId,
      details: { imported, source: "qonto_sync", isFirstSync },
    },
  });

  return imported;
}

// deleteBankConnection
export async function deleteBankConnection(societyId: string, connectionId: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
    const connection = await prisma.bankConnection.findFirst({ where: { id: connectionId, societyId } });
    if (!connection) return { success: false, error: "Connexion introuvable" };
    await prisma.bankConnection.update({ where: { id: connectionId }, data: { status: "expired" } });
    await prisma.bankAccount.updateMany({ where: { connectionId }, data: { connectionId: null, powensAccountId: null } });
    await createAuditLog({ societyId, userId: session.user.id, action: "DELETE",
      entity: "BankConnection", entityId: connectionId,
      details: { institutionName: connection.institutionName } });
    revalidatePath("/banque");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteBankConnection]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}