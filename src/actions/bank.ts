"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/encryption";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  createBankTransactionSchema,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
  type CreateBankTransactionInput,
} from "@/validations/bank";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { applyAutoTag } from "@/actions/cashflow";
import { normalizeLabel } from "@/lib/normalize-label";

// ─── Comptes bancaires ────────────────────────────────────────────────────────

export async function createBankAccount(
  societyId: string,
  input: CreateBankAccountInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = createBankAccountSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const ibanEncrypted = encrypt(parsed.data.iban);

    const account = await prisma.bankAccount.create({
      data: {
        societyId,
        bankName: parsed.data.bankName,
        accountName: parsed.data.accountName,
        ibanEncrypted,
        initialBalance: parsed.data.initialBalance,
        currentBalance: parsed.data.initialBalance,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "BankAccount",
      entityId: account.id,
      details: { bankName: parsed.data.bankName, accountName: parsed.data.accountName },
    });

    revalidatePath("/banque");
    return { success: true, data: { id: account.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createBankAccount]", error);
    return { success: false, error: "Erreur lors de la création du compte" };
  }
}

export async function updateBankAccount(
  societyId: string,
  input: UpdateBankAccountInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = updateBankAccountSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, ...data } = parsed.data;

    const existing = await prisma.bankAccount.findFirst({
      where: { id, societyId },
    });
    if (!existing) return { success: false, error: "Compte introuvable" };

    await prisma.bankAccount.update({ where: { id }, data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "BankAccount",
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath("/banque");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateBankAccount]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function getBankAccounts(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  const accounts = await prisma.bankAccount.findMany({
    where: { societyId },
    include: {
      _count: { select: { transactions: true } },
    },
    orderBy: { accountName: "asc" },
  });

  // Déchiffrer les IBAN pour l'affichage (masqués)
  return accounts.map((account) => {
    let ibanMasked = "****";
    try {
      const iban = decrypt(account.ibanEncrypted);
      ibanMasked = iban.slice(0, 4) + " **** **** " + iban.slice(-4);
    } catch {
      // ignore
    }
    return { ...account, ibanMasked };
  });
}

export async function getBankAccountById(societyId: string, accountId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  const [account, unreconciledCount] = await Promise.all([
    prisma.bankAccount.findFirst({
      where: { id: accountId, societyId },
      include: {
        transactions: {
          orderBy: { transactionDate: "desc" },
          take: 50,
        },
        connection: {
          select: { institutionName: true, status: true },
        },
        _count: { select: { transactions: true } },
      },
    }),
    prisma.bankTransaction.count({
      where: { bankAccountId: accountId, isReconciled: false },
    }),
  ]);

  if (!account) return null;

  let ibanMasked = "****";
  try {
    const iban = decrypt(account.ibanEncrypted);
    ibanMasked = iban.slice(0, 4) + " **** **** " + iban.slice(-4);
  } catch {
    // ignore
  }

  return { ...account, ibanMasked, unreconciledCount };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function createBankTransaction(
  societyId: string,
  input: CreateBankTransactionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = createBankTransactionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const account = await prisma.bankAccount.findFirst({
      where: { id: parsed.data.bankAccountId, societyId },
    });
    if (!account) return { success: false, error: "Compte introuvable" };

    // Auto-tag : si pas de catégorie fournie, tenter la catégorisation automatique
    const category = parsed.data.category ?? await applyAutoTag(societyId, parsed.data.label);

    const transaction = await prisma.bankTransaction.create({
      data: {
        bankAccountId: parsed.data.bankAccountId,
        transactionDate: new Date(parsed.data.transactionDate),
        amount: parsed.data.amount,
        label: parsed.data.label,
        reference: parsed.data.reference ?? null,
        category,
      },
    });

    // Mettre à jour le solde
    await prisma.bankAccount.update({
      where: { id: parsed.data.bankAccountId },
      data: { currentBalance: { increment: parsed.data.amount } },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "BankTransaction",
      entityId: transaction.id,
      details: { amount: parsed.data.amount, label: parsed.data.label },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${parsed.data.bankAccountId}`);
    revalidatePath("/comptabilite/cashflow");

    return { success: true, data: { id: transaction.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createBankTransaction]", error);
    return { success: false, error: "Erreur lors de la création de la transaction" };
  }
}

// ─── Recalculer le solde d'un compte ─────────────────────────────────────────

export async function recalculateBankBalance(
  societyId: string,
  bankAccountId: string
): Promise<ActionResult<{ newBalance: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, societyId },
      select: { id: true, initialBalance: true, currentBalance: true },
    });
    if (!account) return { success: false, error: "Compte introuvable" };

    const txAgg = await prisma.bankTransaction.aggregate({
      where: { bankAccountId },
      _sum: { amount: true },
    });

    const newBalance = account.initialBalance + (txAgg._sum.amount ?? 0);

    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { currentBalance: newBalance },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "BankAccount",
      entityId: bankAccountId,
      details: { action: "recalculate_balance", oldBalance: account.currentBalance, newBalance },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${bankAccountId}`);

    return { success: true, data: { newBalance } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[recalculateBankBalance]", error);
    return { success: false, error: "Erreur lors du recalcul du solde" };
  }
}

// ─── Corriger manuellement le solde d'un compte ─────────────────────────────

export async function correctBankBalance(
  societyId: string,
  bankAccountId: string,
  correctBalance: number
): Promise<ActionResult<{ newBalance: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, societyId },
      select: { id: true, initialBalance: true, currentBalance: true },
    });
    if (!account) return { success: false, error: "Compte introuvable" };

    // Ajuster initialBalance pour que initialBalance + sum(transactions) = correctBalance
    const txAgg = await prisma.bankTransaction.aggregate({
      where: { bankAccountId },
      _sum: { amount: true },
    });
    const txSum = txAgg._sum.amount ?? 0;
    const newInitialBalance = correctBalance - txSum;

    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { initialBalance: newInitialBalance, currentBalance: correctBalance },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "BankAccount",
      entityId: bankAccountId,
      details: {
        action: "correct_balance",
        oldBalance: account.currentBalance,
        newBalance: correctBalance,
        oldInitialBalance: account.initialBalance,
        newInitialBalance,
      },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${bankAccountId}`);

    return { success: true, data: { newBalance: correctBalance } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[correctBankBalance]", error);
    return { success: false, error: "Erreur lors de la correction du solde" };
  }
}

// ─── Import de relevé bancaire (CSV/XLSX) ───────────────────────────────────

export type ImportRow = {
  transactionDate: string; // ISO ou dd/MM/yyyy
  amount: number;
  label: string;
  reference?: string;
};

export type ImportBankStatementResult = {
  imported: number;
  skipped: number;
  duplicates: number;
};

/**
 * Importe un relevé bancaire en masse avec dédoublonnage intelligent.
 *
 * Stratégie anti-doublon (3 niveaux) :
 * 1. externalId exact (référence bancaire unique)
 * 2. Empreinte (date + montant + libellé normalisé) — détecte les doublons
 *    même si la référence diffère légèrement entre le fichier et la sync
 * 3. Tolérance ±1 jour sur la date (les banques décalent parfois la date
 *    d'opération vs date de valeur)
 */
export async function importBankStatement(
  societyId: string,
  bankAccountId: string,
  rows: ImportRow[]
): Promise<ActionResult<ImportBankStatementResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    if (rows.length === 0) return { success: false, error: "Aucune ligne à importer" };
    if (rows.length > 2000) return { success: false, error: "Maximum 2000 lignes par import" };

    // Vérifier que le compte appartient à la société
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, societyId },
      select: { id: true },
    });
    if (!account) return { success: false, error: "Compte introuvable" };

    // ── Charger les transactions existantes pour dédoublonnage ────────
    // Déterminer la plage de dates du fichier importé
    const importDates = rows.map((r) => parseFlexDate(r.transactionDate)).filter(Boolean) as Date[];
    if (importDates.length === 0) return { success: false, error: "Aucune date valide dans le fichier" };

    const minDate = new Date(Math.min(...importDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...importDates.map((d) => d.getTime())));
    // Élargir de ±2 jours pour couvrir les décalages
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 2);

    const existingTxs = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        transactionDate: { gte: minDate, lte: maxDate },
      },
      select: {
        transactionDate: true,
        amount: true,
        label: true,
        externalId: true,
      },
    });

    // Index des empreintes existantes : "YYYY-MM-DD|montant|label_norm"
    const existingFingerprints = new Set<string>();
    // Index élargi ±1 jour pour tolérance de date
    const existingFingerprintsLoose = new Set<string>();
    const existingExternalIds = new Set<string>();

    for (const tx of existingTxs) {
      if (tx.externalId) existingExternalIds.add(tx.externalId);
      const d = new Date(tx.transactionDate);
      const dateStr = toDateKey(d);
      const norm = normalizeLabel(tx.label);
      const amountKey = Math.round(tx.amount * 100).toString();
      existingFingerprints.add(`${dateStr}|${amountKey}|${norm}`);

      // ±1 jour
      for (const offset of [-1, 0, 1]) {
        const offsetDate = new Date(d);
        offsetDate.setDate(offsetDate.getDate() + offset);
        existingFingerprintsLoose.add(`${toDateKey(offsetDate)}|${amountKey}|${norm}`);
      }
    }

    // ── Importer ─────────────────────────────────────────────────────
    const batchId = "csv-import-" + String(Date.now());
    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let balanceDelta = 0;

    for (const row of rows) {
      // Valider la ligne
      const date = parseFlexDate(row.transactionDate);
      if (!date || !row.label?.trim() || isNaN(row.amount)) {
        skipped++;
        continue;
      }

      const dateStr = toDateKey(date);
      const norm = normalizeLabel(row.label);
      const amountKey = Math.round(row.amount * 100).toString();
      const fingerprint = `${dateStr}|${amountKey}|${norm}`;

      // Niveau 1 : référence exacte
      if (row.reference && existingExternalIds.has(row.reference)) {
        duplicates++;
        continue;
      }

      // Niveau 2 : empreinte exacte (date + montant + libellé)
      if (existingFingerprints.has(fingerprint)) {
        duplicates++;
        continue;
      }

      // Niveau 3 : empreinte avec tolérance ±1 jour
      if (existingFingerprintsLoose.has(fingerprint)) {
        duplicates++;
        continue;
      }

      // Auto-tag
      const category = await applyAutoTag(societyId, row.label);

      await prisma.bankTransaction.create({
        data: {
          bankAccountId,
          transactionDate: date,
          amount: row.amount,
          label: row.label.trim(),
          reference: row.reference?.trim() || null,
          externalId: row.reference?.trim() || null,
          category,
          importBatch: batchId,
        },
      });

      // Ajouter au set pour dédoublonner dans le fichier lui-même
      existingFingerprints.add(fingerprint);
      for (const offset of [-1, 0, 1]) {
        const offsetDate = new Date(date);
        offsetDate.setDate(offsetDate.getDate() + offset);
        existingFingerprintsLoose.add(`${toDateKey(offsetDate)}|${amountKey}|${norm}`);
      }
      if (row.reference) existingExternalIds.add(row.reference);

      balanceDelta += row.amount;
      imported++;
    }

    // Mettre à jour le solde
    if (imported > 0) {
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: { increment: balanceDelta } },
      });
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "BankTransaction",
      entityId: batchId,
      details: { action: "csv_import", imported, skipped, duplicates, totalRows: rows.length },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${bankAccountId}`);
    revalidatePath("/comptabilite/cashflow");

    return { success: true, data: { imported, skipped, duplicates } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[importBankStatement]", error);
    return { success: false, error: "Erreur lors de l'import du relevé" };
  }
}

/** Parse une date flexible : dd/MM/yyyy, yyyy-MM-dd, dd-MM-yyyy, dd.MM.yyyy */
function parseFlexDate(input: string): Date | null {
  if (!input?.trim()) return null;
  const s = input.trim();

  // ISO : yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // FR : dd/MM/yyyy ou dd-MM-yyyy ou dd.MM.yyyy
  const match = s.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})/);
  if (match) {
    const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
