"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { bankReconciliationSchema, type BankReconciliationInput } from "@/validations/bank";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

// ─── Données pour le rapprochement ────────────────────────────────────────────

export async function getUnreconciledTransactions(
  societyId: string,
  bankAccountId: string
) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.bankTransaction.findMany({
    where: {
      bankAccountId,
      isReconciled: false,
      bankAccount: { societyId },
    },
    orderBy: { transactionDate: "desc" },
  });
}

export async function getUnreconciledPayments(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.payment.findMany({
    where: {
      isReconciled: false,
      invoice: { societyId },
    },
    include: {
      invoice: {
        include: {
          lease: {
            include: {
              lot: { include: { building: true } },
              tenant: true,
            },
          },
          tenant: true,
        },
      },
    },
    orderBy: { paidAt: "desc" },
  });
}

export async function getReconciledItems(societyId: string, bankAccountId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.bankReconciliation.findMany({
    where: {
      transaction: {
        bankAccountId,
        bankAccount: { societyId },
      },
    },
    include: {
      transaction: true,
      payment: {
        include: {
          invoice: { include: { tenant: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Rapprochement automatique ────────────────────────────────────────────────

export async function autoReconcile(
  societyId: string,
  bankAccountId: string
): Promise<ActionResult<{ matched: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // Vérifier que le compte appartient à la société
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, societyId },
    });
    if (!account) return { success: false, error: "Compte introuvable" };

    // Récupérer toutes les transactions et paiements non rapprochés
    const [transactions, payments] = await Promise.all([
      prisma.bankTransaction.findMany({
        where: { bankAccountId, isReconciled: false },
        orderBy: { transactionDate: "asc" },
      }),
      prisma.payment.findMany({
        where: { isReconciled: false, invoice: { societyId } },
        orderBy: { paidAt: "asc" },
      }),
    ]);

    let matched = 0;
    const usedPaymentIds = new Set<string>();
    const usedTransactionIds = new Set<string>();

    for (const tx of transactions) {
      if (usedTransactionIds.has(tx.id)) continue;

      // Passe 1 : match exact référence + montant
      const exactMatch = payments.find(
        (p) =>
          !usedPaymentIds.has(p.id) &&
          p.reference &&
          tx.reference &&
          p.reference === tx.reference &&
          Math.abs(p.amount - Math.abs(tx.amount)) < 0.01
      );

      if (exactMatch) {
        await createReconciliationRecord(tx.id, exactMatch.id, true);
        usedPaymentIds.add(exactMatch.id);
        usedTransactionIds.add(tx.id);
        matched++;
        continue;
      }

      // Passe 2 : match approximatif montant ±0.01€ + date ±3 jours
      const approxMatch = payments.find((p) => {
        if (usedPaymentIds.has(p.id)) return false;
        const amountMatch = Math.abs(p.amount - Math.abs(tx.amount)) <= 0.01;
        if (!amountMatch) return false;
        const txDate = tx.transactionDate.getTime();
        const pDate = new Date(p.paidAt).getTime();
        const diffDays = Math.abs(txDate - pDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 3;
      });

      if (approxMatch) {
        await createReconciliationRecord(tx.id, approxMatch.id, true);
        usedPaymentIds.add(approxMatch.id);
        usedTransactionIds.add(tx.id);
        matched++;
      }
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "BankAccount",
      entityId: bankAccountId,
      details: { action: "auto_reconcile", matched },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${bankAccountId}`);
    revalidatePath(`/banque/${bankAccountId}/rapprochement`);
    revalidatePath("/comptabilite");

    return { success: true, data: { matched } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[autoReconcile]", error);
    return { success: false, error: "Erreur lors du rapprochement automatique" };
  }
}

// ─── Rapprochement manuel ─────────────────────────────────────────────────────

export async function manualReconcile(
  societyId: string,
  input: BankReconciliationInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = bankReconciliationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    // Vérifier que la transaction appartient à la société
    const transaction = await prisma.bankTransaction.findFirst({
      where: {
        id: parsed.data.transactionId,
        bankAccount: { societyId },
      },
    });
    if (!transaction) return { success: false, error: "Transaction introuvable" };

    // Vérifier que le paiement appartient à la société
    const payment = await prisma.payment.findFirst({
      where: {
        id: parsed.data.paymentId,
        invoice: { societyId },
      },
    });
    if (!payment) return { success: false, error: "Paiement introuvable" };

    await createReconciliationRecord(
      parsed.data.transactionId,
      parsed.data.paymentId,
      true,
      parsed.data.notes,
      session.user.id
    );

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "BankReconciliation",
      entityId: parsed.data.transactionId,
      details: { transactionId: parsed.data.transactionId, paymentId: parsed.data.paymentId },
    });

    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath(`/banque/${transaction.bankAccountId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[manualReconcile]", error);
    return { success: false, error: "Erreur lors du rapprochement" };
  }
}

// ─── Annuler un rapprochement ─────────────────────────────────────────────────

export async function unreconcile(
  societyId: string,
  reconciliationId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: {
        id: reconciliationId,
        transaction: { bankAccount: { societyId } },
      },
      include: { transaction: true },
    });
    if (!reconciliation) return { success: false, error: "Rapprochement introuvable" };

    await prisma.$transaction([
      prisma.bankReconciliation.delete({ where: { id: reconciliationId } }),
      prisma.bankTransaction.update({
        where: { id: reconciliation.transactionId },
        data: { isReconciled: false },
      }),
      prisma.payment.update({
        where: { id: reconciliation.paymentId },
        data: { isReconciled: false },
      }),
    ]);

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "BankReconciliation",
      entityId: reconciliationId,
    });

    revalidatePath(`/banque/${reconciliation.transaction.bankAccountId}/rapprochement`);
    revalidatePath(`/banque/${reconciliation.transaction.bankAccountId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[unreconcile]", error);
    return { success: false, error: "Erreur lors de l'annulation" };
  }
}

// ─── Générer une écriture comptable ──────────────────────────────────────────

export async function generateJournalEntry(
  societyId: string,
  transactionId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, bankAccount: { societyId } },
      include: {
        reconciliations: {
          include: {
            payment: { include: { invoice: true } },
          },
        },
        bankAccount: true,
      },
    });
    if (!transaction) return { success: false, error: "Transaction introuvable" };

    // Chercher ou créer les comptes comptables
    const [compte512, compte411, compte658] = await Promise.all([
      prisma.accountingAccount.upsert({
        where: { societyId_code: { societyId, code: "512" } },
        update: {},
        create: { societyId, code: "512", label: "Banque", type: "5" },
      }),
      prisma.accountingAccount.upsert({
        where: { societyId_code: { societyId, code: "411" } },
        update: {},
        create: { societyId, code: "411", label: "Clients", type: "4" },
      }),
      prisma.accountingAccount.upsert({
        where: { societyId_code: { societyId, code: "658" } },
        update: {},
        create: { societyId, code: "658", label: "Charges diverses de gestion", type: "6" },
      }),
    ]);

    const amount = Math.abs(transaction.amount);
    const isIncome = transaction.amount > 0;
    const hasInvoice = transaction.reconciliations.length > 0;

    // Compte de contrepartie selon la nature de la transaction
    const contraAccount = hasInvoice ? compte411 : compte658;

    const entry = await prisma.journalEntry.create({
      data: {
        societyId,
        journalType: "BANQUE",
        entryDate: transaction.transactionDate,
        label: transaction.label,
        reference: transaction.reference ?? undefined,
        lines: {
          create: isIncome
            ? [
                // Entrée d'argent : Débit 512 Banque / Crédit 411 Clients
                { accountId: compte512.id, debit: amount, credit: 0, label: transaction.label },
                { accountId: contraAccount.id, debit: 0, credit: amount, label: transaction.label },
              ]
            : [
                // Sortie d'argent : Débit 658 Charges / Crédit 512 Banque
                { accountId: contraAccount.id, debit: amount, credit: 0, label: transaction.label },
                { accountId: compte512.id, debit: 0, credit: amount, label: transaction.label },
              ],
        },
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: entry.id,
      details: { transactionId, amount, type: isIncome ? "recette" : "depense" },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { id: entry.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[generateJournalEntry]", error);
    return { success: false, error: "Erreur lors de la génération de l'écriture" };
  }
}

// ─── Helper interne ───────────────────────────────────────────────────────────

async function createReconciliationRecord(
  transactionId: string,
  paymentId: string,
  isValidated: boolean,
  notes?: string,
  validatedBy?: string
): Promise<void> {
  await prisma.$transaction([
    prisma.bankReconciliation.create({
      data: {
        transactionId,
        paymentId,
        isValidated,
        validatedAt: isValidated ? new Date() : null,
        validatedBy: validatedBy ?? null,
        notes: notes ?? null,
      },
    }),
    prisma.bankTransaction.update({
      where: { id: transactionId },
      data: { isReconciled: true },
    }),
    prisma.payment.update({
      where: { id: paymentId },
      data: { isReconciled: true },
    }),
  ]);
}
