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
    return { success: true, data: { synced } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[syncOpenBankingAccounts]", msg);
    return { success: false, error: msg };
  }
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
    return { success: true, data: { imported } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[syncAccountTransactions]", error);
    return { success: false, error: "Erreur sync transactions" };
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
  const dateFrom = row?.lastSyncAt
    ? row.lastSyncAt.toISOString().split("T")[0]
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const transactions = await getPowensTransactions(userId, powensAccountId, userToken, dateFrom);
  let imported = 0;
  let balanceDelta = 0;
  for (const tx of transactions) {
    const externalId = String(tx.id);
    const dup = await prisma.bankTransaction.findFirst({ where: { bankAccountId, externalId } });
    if (dup) continue;
    const amount = tx.value;
    const label = tx.simplified_wording ?? tx.label ?? tx.original_wording ?? "Transaction";
    await prisma.bankTransaction.create({ data: {
      bankAccountId, transactionDate: new Date(tx.date),
      valueDate: tx.value_date ? new Date(tx.value_date) : null,
      amount, label, reference: externalId, externalId,
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
  } else {
    // Syncs suivantes : incrémenter le solde avec les nouvelles transactions.
    await prisma.bankAccount.update({ where: { id: bankAccountId }, data: {
      ...(balanceDelta !== 0 ? { currentBalance: { increment: balanceDelta } } : {}),
      lastSyncAt: new Date(),
    } });
  }
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

    await prisma.bankTransaction.create({
      data: {
        bankAccountId,
        transactionDate: new Date(tx.settled_at),
        valueDate: tx.emitted_at ? new Date(tx.emitted_at) : null,
        amount,
        label,
        reference: tx.reference || externalId,
        category: tx.category || null,
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