"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { encrypt } from "@/lib/encryption";
import {
  getInstitutions,
  createAgreement,
  createRequisition,
  getRequisition,
  getAccountDetails,
  getAccountTransactions,
  type GocardlessInstitution,
} from "@/lib/gocardless";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

// ─── Liste des banques disponibles ────────────────────────────────────────────

export async function getGocardlessInstitutions(
  societyId: string
): Promise<ActionResult<GocardlessInstitution[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const institutions = await getInstitutions("FR");
    return { success: true, data: institutions };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getGocardlessInstitutions]", error);
    return { success: false, error: "Impossible de récupérer la liste des banques" };
  }
}

// ─── Initier une connexion Open Banking ───────────────────────────────────────

export async function initiateOpenBanking(
  societyId: string,
  institutionId: string,
  institutionName: string
): Promise<ActionResult<{ authLink: string; connectionId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectUrl = `${appUrl}/api/banque/callback`;
    const reference = `${societyId}-${Date.now()}`;

    // 1. Créer l'accord (90 jours d'accès)
    const agreement = await createAgreement(institutionId);

    // 2. Créer la réquisition (lien d'autorisation)
    const requisition = await createRequisition(
      institutionId,
      agreement.id,
      redirectUrl,
      reference
    );

    // 3. Sauvegarder la connexion en BDD
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const connection = await prisma.bankConnection.create({
      data: {
        societyId,
        requisitionId: requisition.id,
        institutionId,
        institutionName,
        status: "CR",
        authLink: requisition.link,
        agreementId: agreement.id,
        expiresAt,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "BankConnection",
      entityId: connection.id,
      details: { institutionId, institutionName },
    });

    return { success: true, data: { authLink: requisition.link, connectionId: connection.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[initiateOpenBanking]", error);
    return { success: false, error: "Erreur lors de la connexion bancaire" };
  }
}

// ─── Synchroniser les comptes après autorisation ──────────────────────────────

export async function syncOpenBankingAccounts(
  societyId: string,
  connectionId: string
): Promise<ActionResult<{ synced: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, societyId },
    });
    if (!connection) return { success: false, error: "Connexion introuvable" };

    // Vérifier le statut de la réquisition
    const requisition = await getRequisition(connection.requisitionId);

    // Mettre à jour le statut
    await prisma.bankConnection.update({
      where: { id: connectionId },
      data: { status: requisition.status },
    });

    if (requisition.status !== "LN") {
      return {
        success: false,
        error: `La connexion bancaire n'est pas encore autorisée (statut: ${requisition.status})`,
      };
    }

    let synced = 0;

    // Pour chaque compte autorisé
    for (const accountId of requisition.accounts) {
      // Récupérer les détails du compte
      let accountDetails;
      try {
        accountDetails = await getAccountDetails(accountId);
      } catch {
        console.error(`[syncOpenBankingAccounts] Impossible de récupérer le compte ${accountId}`);
        continue;
      }

      // Vérifier si le compte existe déjà
      const existing = await prisma.bankAccount.findFirst({
        where: { gocardlessAccountId: accountId },
      });

      let bankAccountId: string;

      if (existing) {
        bankAccountId = existing.id;
      } else {
        // Créer le compte bancaire
        const ibanToEncrypt = accountDetails.iban ?? "IBAN_NON_DISPONIBLE";
        const bankAccount = await prisma.bankAccount.create({
          data: {
            societyId,
            bankName: connection.institutionName,
            accountName: accountDetails.name ?? accountDetails.ownerName ?? "Compte",
            ibanEncrypted: encrypt(ibanToEncrypt),
            initialBalance: 0,
            currentBalance: 0,
            gocardlessAccountId: accountId,
            connectionId,
          },
        });
        bankAccountId = bankAccount.id;

        await createAuditLog({
          societyId,
          userId: session.user.id,
          action: "CREATE",
          entity: "BankAccount",
          entityId: bankAccountId,
          details: { bankName: connection.institutionName, gocardlessAccountId: accountId },
        });
      }

      // Synchroniser les transactions
      await syncAccountTransactionsInternal(societyId, bankAccountId, accountId);
      synced++;
    }

    revalidatePath("/banque");
    return { success: true, data: { synced } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[syncOpenBankingAccounts]", error);
    return { success: false, error: "Erreur lors de la synchronisation" };
  }
}

// ─── Synchroniser les transactions d'un compte ────────────────────────────────

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
    });
    if (!account) return { success: false, error: "Compte introuvable" };

    if (!account.gocardlessAccountId) {
      return { success: false, error: "Ce compte n'est pas lié à Open Banking" };
    }

    const imported = await syncAccountTransactionsInternal(
      societyId,
      bankAccountId,
      account.gocardlessAccountId
    );

    revalidatePath("/banque");
    revalidatePath(`/banque/${bankAccountId}`);

    return { success: true, data: { imported } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[syncAccountTransactions]", error);
    return { success: false, error: "Erreur lors de la synchronisation des transactions" };
  }
}

// ─── Logique interne de sync (réutilisable) ───────────────────────────────────

async function syncAccountTransactionsInternal(
  societyId: string,
  bankAccountId: string,
  gocardlessAccountId: string
): Promise<number> {
  const account = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { lastSyncAt: true, currentBalance: true },
  });

  // Calculer la date de début : lastSyncAt ou 90 jours en arrière
  const dateFrom = account?.lastSyncAt
    ? account.lastSyncAt.toISOString().split("T")[0]
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const response = await getAccountTransactions(gocardlessAccountId, dateFrom);
  const bookedTransactions = response.transactions.booked;

  let imported = 0;
  let balanceDelta = 0;

  for (const tx of bookedTransactions) {
    const externalId = tx.transactionId;
    if (!externalId) continue;

    const amount = parseFloat(tx.transactionAmount.amount);
    const label =
      tx.remittanceInformationUnstructured ??
      tx.creditorName ??
      tx.debtorName ??
      "Transaction";

    // Upsert pour éviter les doublons
    const result = await prisma.bankTransaction.upsert({
      where: {
        bankAccountId_externalId: { bankAccountId, externalId },
      },
      update: {}, // Ne rien modifier si déjà importé
      create: {
        bankAccountId,
        transactionDate: new Date(tx.bookingDate),
        valueDate: tx.valueDate ? new Date(tx.valueDate) : null,
        amount,
        label,
        reference: externalId,
        externalId,
        importBatch: `sync-${Date.now()}`,
      },
    });

    // Compter seulement les nouvelles transactions (créées, pas mises à jour)
    if (result.createdAt.getTime() === result.createdAt.getTime()) {
      const isNew =
        !account?.lastSyncAt ||
        new Date(tx.bookingDate) > account.lastSyncAt;
      if (isNew) {
        balanceDelta += amount;
        imported++;
      }
    }
  }

  // Mettre à jour le solde et la date de sync
  if (balanceDelta !== 0) {
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        currentBalance: { increment: balanceDelta },
        lastSyncAt: new Date(),
      },
    });
  } else {
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { lastSyncAt: new Date() },
    });
  }

  // Log d'audit (sans userId car appelé aussi depuis le cron)
  await prisma.auditLog.create({
    data: {
      societyId,
      action: "CREATE",
      entity: "BankTransaction",
      entityId: bankAccountId,
      details: { imported, source: "gocardless_sync" },
    },
  });

  return imported;
}

// ─── Supprimer une connexion bancaire ─────────────────────────────────────────

export async function deleteBankConnection(
  societyId: string,
  connectionId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, societyId },
    });
    if (!connection) return { success: false, error: "Connexion introuvable" };

    // Passer en statut suspendu et dissocier les comptes
    await prisma.$transaction([
      prisma.bankConnection.update({
        where: { id: connectionId },
        data: { status: "SU" },
      }),
      prisma.bankAccount.updateMany({
        where: { connectionId },
        data: { connectionId: null, gocardlessAccountId: null },
      }),
    ]);

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "BankConnection",
      entityId: connectionId,
      details: { institutionName: connection.institutionName },
    });

    revalidatePath("/banque");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteBankConnection]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

// ─── Export de la fonction interne pour le cron ───────────────────────────────

export { syncAccountTransactionsInternal };
