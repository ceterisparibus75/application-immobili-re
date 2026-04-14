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
