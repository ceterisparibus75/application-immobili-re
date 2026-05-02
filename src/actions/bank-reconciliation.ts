"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { bankReconciliationSchema, type BankReconciliationInput } from "@/validations/bank";
import { resolveOpenFiscalYearIdForDate } from "@/lib/accounting-period";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { generateAndSendQuittance } from "@/actions/invoice";
import { getOutstandingAmount } from "@/lib/reports/invoice-metrics";
import type { Prisma } from "@/generated/prisma/client";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

type AccountFallback = {
  code: string;
  label: string;
  type: string;
};

type AccountingJournalClient = Pick<
  Prisma.TransactionClient,
  "accountingAccount" | "bankTransaction" | "fiscalYear" | "journalEntry"
>;

type BankJournalTransaction = {
  id: string;
  amount: number;
  transactionDate: Date;
  label: string;
  reference: string | null;
  category: string | null;
  journalEntryId: string | null;
  reconciliations: Array<{
    payment: {
      invoice: {
        isThirdPartyManaged: boolean;
        managementFeeTTC?: number | null;
      } | null;
    } | null;
  }>;
};

const BANK_CATEGORY_ACCOUNT_FALLBACKS: Record<string, AccountFallback> = {
  loyers: { code: "706100", label: "Loyers", type: "7" },
  charges_locatives: { code: "706500", label: "Refacturation de charges locatives", type: "7" },
  regularisation: { code: "758000", label: "Produits divers de gestion courante", type: "7" },
  autres_revenus: { code: "758000", label: "Produits divers de gestion courante", type: "7" },
  depot_garantie: { code: "165000", label: "Depots et cautionnements recus", type: "1" },
  cession_immeuble: { code: "775000", label: "Produits des cessions d'elements d'actif", type: "7" },
  charges_copro: { code: "614000", label: "Charges locatives et de copropriete", type: "6" },
  assurance: { code: "616000", label: "Primes d'assurance", type: "6" },
  entretien_courant: { code: "615000", label: "Entretien et reparations", type: "6" },
  taxes: { code: "635000", label: "Autres impots et taxes", type: "6" },
  frais_bancaires: { code: "627000", label: "Services bancaires et assimiles", type: "6" },
  interets_emprunt: { code: "661100", label: "Interets des emprunts", type: "6" },
  remboursement_emprunt: { code: "164000", label: "Emprunts aupres des etablissements de credit", type: "1" },
  honoraires: { code: "622000", label: "Remunerations d'intermediaires et honoraires", type: "6" },
  energie: { code: "606100", label: "Fournitures non stockables - eau, energie", type: "6" },
  fournitures: { code: "606300", label: "Fournitures d'entretien et de petit equipement", type: "6" },
  frais_gestion: { code: "622000", label: "Remunerations d'intermediaires et honoraires", type: "6" },
  divers_depense: { code: "658000", label: "Charges diverses de gestion courante", type: "6" },
  travaux: { code: "615000", label: "Entretien et reparations", type: "6" },
  acquisition_immeuble: { code: "213000", label: "Constructions", type: "2" },
  virement_interne: { code: "580000", label: "Virements internes", type: "5" },
  apport_cca: { code: "455000", label: "Associes - comptes courants", type: "4" },
  remboursement_cca: { code: "455000", label: "Associes - comptes courants", type: "4" },
  souscription_emprunt: { code: "164000", label: "Emprunts aupres des etablissements de credit", type: "1" },
};

function getBankCategoryAccountFallback(category: string | null | undefined): AccountFallback | null {
  if (!category) return null;
  return BANK_CATEGORY_ACCOUNT_FALLBACKS[category] ?? null;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

async function upsertAccountingAccount(
  client: Pick<Prisma.TransactionClient, "accountingAccount">,
  societyId: string,
  fallback: AccountFallback
) {
  return client.accountingAccount.upsert({
    where: { societyId_code: { societyId, code: fallback.code } },
    update: {},
    create: {
      societyId,
      code: fallback.code,
      label: fallback.label,
      type: fallback.type,
    },
  });
}

async function createBankJournalEntryForTransaction(
  client: AccountingJournalClient,
  societyId: string,
  transaction: BankJournalTransaction,
  options: { linkTransaction?: boolean } = {}
): Promise<string> {
  const amount = Math.abs(transaction.amount);
  const isIncome = transaction.amount > 0;
  const hasInvoice = transaction.reconciliations.length > 0;
  const categoryContraFallback = hasInvoice
    ? null
    : getBankCategoryAccountFallback(transaction.category);

  const [compte512, compte411, compte658, compte622, categoryContraAccount] = await Promise.all([
    upsertAccountingAccount(client, societyId, { code: "512", label: "Banque", type: "5" }),
    upsertAccountingAccount(client, societyId, { code: "411", label: "Clients", type: "4" }),
    upsertAccountingAccount(client, societyId, { code: "658", label: "Charges diverses de gestion", type: "6" }),
    upsertAccountingAccount(client, societyId, { code: "622", label: "Remunerations d'intermediaires et honoraires", type: "6" }),
    categoryContraFallback
      ? upsertAccountingAccount(client, societyId, categoryContraFallback)
      : Promise.resolve(null),
  ]);

  const thirdPartyInvoice = transaction.reconciliations.find(
    (r) => r.payment?.invoice?.isThirdPartyManaged && r.payment?.invoice?.managementFeeTTC
  )?.payment?.invoice;
  const contraAccount = hasInvoice ? compte411 : categoryContraAccount ?? compte658;

  let journalLines;
  if (isIncome && thirdPartyInvoice?.managementFeeTTC) {
    const feeAmount = thirdPartyInvoice.managementFeeTTC;
    const grossAmount = amount + feeAmount;
    journalLines = [
      { accountId: compte512.id, debit: amount, credit: 0, label: "Virement agence (net)" },
      { accountId: compte622.id, debit: roundCents(feeAmount), credit: 0, label: "Honoraires de gestion" },
      { accountId: compte411.id, debit: 0, credit: roundCents(grossAmount), label: "Loyer brut TTC" },
    ];
  } else if (isIncome) {
    journalLines = [
      { accountId: compte512.id, debit: amount, credit: 0, label: transaction.label },
      { accountId: contraAccount.id, debit: 0, credit: amount, label: transaction.label },
    ];
  } else {
    journalLines = [
      { accountId: contraAccount.id, debit: amount, credit: 0, label: transaction.label },
      { accountId: compte512.id, debit: 0, credit: amount, label: transaction.label },
    ];
  }

  const entry = await client.journalEntry.create({
    data: {
      societyId,
      fiscalYearId: await resolveOpenFiscalYearIdForDate(client, societyId, transaction.transactionDate),
      journalType: "BQUE",
      entryDate: transaction.transactionDate,
      label: transaction.label,
      reference: transaction.reference ?? undefined,
      lines: { create: journalLines },
    },
  });

  if (options.linkTransaction ?? true) {
    await client.bankTransaction.update({
      where: { id: transaction.id },
      data: { journalEntryId: entry.id },
    });
  }

  return entry.id;
}

// ─── Données pour le rapprochement ────────────────────────────────────────────

export async function getUnreconciledTransactions(
  societyId: string,
  bankAccountId: string
) {
  if (!(await getOptionalSocietyActionContext(societyId))) return [];

  return prisma.bankTransaction.findMany({
    where: {
      bankAccountId,
      isReconciled: false,
      bankAccount: { societyId },
    },
    select: {
      id: true,
      transactionDate: true,
      amount: true,
      label: true,
      reference: true,
      journalEntryId: true,
    },
    orderBy: { transactionDate: "desc" },
  });
}

export async function getUnreconciledPayments(societyId: string) {
  if (!(await getOptionalSocietyActionContext(societyId))) return [];

  return prisma.payment.findMany({
    where: {
      isReconciled: false,
      invoice: { societyId },
    },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      method: true,
      reference: true,
      invoice: {
        select: {
          tenant: { select: { companyName: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { paidAt: "desc" },
  });
}

export async function getReconciledItems(societyId: string, bankAccountId: string) {
  if (!(await getOptionalSocietyActionContext(societyId))) return [];

  return prisma.bankReconciliation.findMany({
    where: {
      transaction: {
        bankAccountId,
        bankAccount: { societyId },
      },
    },
    select: {
      id: true,
      transaction: {
        select: {
          id: true,
          label: true,
          transactionDate: true,
          amount: true,
          journalEntryId: true,
        },
      },
      payment: {
        select: {
          invoice: {
            select: {
              tenant: { select: { companyName: true, firstName: true, lastName: true } },
            },
          },
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
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

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
        include: {
          invoice: {
            select: { isThirdPartyManaged: true, expectedNetAmount: true, managementFeeTTC: true },
          },
        },
        orderBy: { paidAt: "asc" },
      }),
    ]);

    let matched = 0;
    const usedPaymentIds = new Set<string>();
    const usedTransactionIds = new Set<string>();

    for (const tx of transactions) {
      if (usedTransactionIds.has(tx.id)) continue;
      if (tx.amount <= 0) continue;

      // Passe 1 : match exact référence + montant
      const exactMatch = payments.find(
        (p) =>
          !usedPaymentIds.has(p.id) &&
          p.reference &&
          tx.reference &&
          p.reference === tx.reference &&
          Math.abs(p.amount - tx.amount) < 0.01
      );

      if (exactMatch) {
        await createReconciliationRecord(tx.id, exactMatch.id, true, undefined, context.userId, {
          societyId,
          transaction: tx,
          payment: exactMatch,
        });
        usedPaymentIds.add(exactMatch.id);
        usedTransactionIds.add(tx.id);
        matched++;
        continue;
      }

      // Passe 2 : match approximatif montant ±0.01€ + date ±3 jours
      const approxMatch = payments.find((p) => {
        if (usedPaymentIds.has(p.id)) return false;
        const amountMatch = Math.abs(p.amount - tx.amount) <= 0.01;
        if (!amountMatch) return false;
        const txDate = tx.transactionDate.getTime();
        const pDate = new Date(p.paidAt).getTime();
        const diffDays = Math.abs(txDate - pDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 3;
      });

      if (approxMatch) {
        await createReconciliationRecord(tx.id, approxMatch.id, true, undefined, context.userId, {
          societyId,
          transaction: tx,
          payment: approxMatch,
        });
        usedPaymentIds.add(approxMatch.id);
        usedTransactionIds.add(tx.id);
        matched++;
        continue;
      }

      // Passe 3 : match montant NET pour baux en gestion tiers
      const netMatch = payments.find((p) => {
        if (usedPaymentIds.has(p.id)) return false;
        if (!p.invoice?.isThirdPartyManaged || !p.invoice?.expectedNetAmount) return false;
        return Math.abs(p.invoice.expectedNetAmount - tx.amount) <= 0.01;
      });

      if (netMatch) {
        await createReconciliationRecord(tx.id, netMatch.id, true, undefined, context.userId, {
          societyId,
          transaction: tx,
          payment: netMatch,
        });
        usedPaymentIds.add(netMatch.id);
        usedTransactionIds.add(tx.id);
        matched++;
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "BankAccount",
      entityId: bankAccountId,
      details: { action: "auto_reconcile", matched },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${bankAccountId}`);
    revalidatePath(`/banque/${bankAccountId}/rapprochement`);
    revalidatePath("/comptabilite");
    revalidatePath("/facturation");
    // Mettre à jour les fiches comptables des locataires
    revalidatePath("/locataires");

    return { success: true, data: { matched } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

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
    if (transaction.amount <= 0) {
      return { success: false, error: "Un paiement locataire doit être rapproché avec une transaction bancaire créditrice" };
    }

    // Vérifier que le paiement appartient à la société
    const payment = await prisma.payment.findFirst({
      where: {
        id: parsed.data.paymentId,
        invoice: { societyId },
      },
      include: {
        invoice: {
          select: {
            isThirdPartyManaged: true,
            expectedNetAmount: true,
            managementFeeTTC: true,
          },
        },
      },
    });
    if (!payment) return { success: false, error: "Paiement introuvable" };
    if (Math.abs(transaction.amount - payment.amount) > 0.01) {
      return { success: false, error: "Le montant de la transaction ne correspond pas au paiement sélectionné" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.bankReconciliation.create({
        data: {
          transactionId: parsed.data.transactionId,
          paymentId: parsed.data.paymentId,
          isValidated: true,
          validatedAt: new Date(),
          validatedBy: context.userId,
          notes: parsed.data.notes ?? null,
        },
      });
      const journalEntryId = transaction.journalEntryId
        ? transaction.journalEntryId
        : await createBankJournalEntryForTransaction(
            tx,
            societyId,
            {
              ...transaction,
              reconciliations: [{ payment: { invoice: payment.invoice } }],
            },
            { linkTransaction: false }
          );
      await tx.bankTransaction.update({
        where: { id: parsed.data.transactionId },
        data: { isReconciled: true, journalEntryId },
      });
      await tx.payment.update({
        where: { id: parsed.data.paymentId },
        data: { isReconciled: true },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "BankReconciliation",
      entityId: parsed.data.transactionId,
      details: { transactionId: parsed.data.transactionId, paymentId: parsed.data.paymentId, journalType: "BQUE" },
    });

    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath(`/banque/${transaction.bankAccountId}`);
    revalidatePath("/comptabilite");
    revalidatePath("/facturation");
    // Mettre à jour la fiche comptable du locataire
    revalidatePath("/locataires");
    if (payment.invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
        select: { tenantId: true },
      });
      if (invoice?.tenantId) {
        revalidatePath(`/locataires/${invoice.tenantId}`);
      }
    }

    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

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
      userId: context.userId,
      action: "DELETE",
      entity: "BankReconciliation",
      entityId: reconciliationId,
    });

    revalidatePath(`/banque/${reconciliation.transaction.bankAccountId}/rapprochement`);
    revalidatePath(`/banque/${reconciliation.transaction.bankAccountId}`);
    revalidatePath("/facturation");
    revalidatePath("/locataires");

    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

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
    if (transaction.journalEntryId) {
      return { success: true, data: { id: transaction.journalEntryId } };
    }

    const amount = Math.abs(transaction.amount);
    const isIncome = transaction.amount > 0;
    const entryId = await createBankJournalEntryForTransaction(prisma, societyId, transaction);

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: entryId,
      details: { transactionId, amount, type: isIncome ? "recette" : "depense" },
    });

    revalidatePath("/comptabilite");
    revalidatePath(`/banque/${transaction.bankAccountId}`);
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    return { success: true, data: { id: entryId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
  validatedBy?: string,
  journalContext?: {
    societyId: string;
    transaction: Omit<BankJournalTransaction, "reconciliations">;
    payment: {
      invoice: {
        isThirdPartyManaged: boolean;
        managementFeeTTC?: number | null;
      } | null;
    };
  }
): Promise<void> {
  if (journalContext) {
    await prisma.$transaction(async (tx) => {
      await tx.bankReconciliation.create({
        data: {
          transactionId,
          paymentId,
          isValidated,
          validatedAt: isValidated ? new Date() : null,
          validatedBy: validatedBy ?? null,
          notes: notes ?? null,
        },
      });
      const journalEntryId = journalContext.transaction.journalEntryId
        ? journalContext.transaction.journalEntryId
        : await createBankJournalEntryForTransaction(
            tx,
            journalContext.societyId,
            {
              ...journalContext.transaction,
              reconciliations: [{ payment: { invoice: journalContext.payment.invoice } }],
            },
            { linkTransaction: false }
          );
      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: { isReconciled: true, journalEntryId },
      });
      await tx.payment.update({
        where: { id: paymentId },
        data: { isReconciled: true },
      });
    });
    return;
  }

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


// ─── Factures en attente (loyers appelés) ─────────────────────────────────────

export async function getPendingInvoices(societyId: string) {
  if (!(await getOptionalSocietyActionContext(societyId))) return [];

  const invoices = await prisma.invoice.findMany({
    where: {
      societyId,
      invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
      status: { in: ["VALIDEE", "ENVOYEE", "EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE", "RELANCEE", "LITIGIEUX"] },
    },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      totalTTC: true,
      dueDate: true,
      status: true,
      payments: { select: { amount: true } },
      tenant: { select: { companyName: true, firstName: true, lastName: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return invoices
    .map((invoice) => ({
      ...invoice,
      totalTTC: getOutstandingAmount(invoice),
    }))
    .filter((invoice) => invoice.totalTTC > 0.01);
}

// ─── Échéances de prêts à rapprocher ─────────────────────────────────────────

export async function getUpcomingLoanLines(societyId: string) {
  if (!(await getOptionalSocietyActionContext(societyId))) return [];

  return prisma.loanAmortizationLine.findMany({
    where: {
      isPaid: false,
      loan: { societyId, status: "EN_COURS" },
    },
    select: {
      id: true,
      period: true,
      dueDate: true,
      principalPayment: true,
      interestPayment: true,
      insurancePayment: true,
      totalPayment: true,
      loan: { select: { id: true, label: true, lender: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

// ─── Rapprochement avec une facture (crée le paiement auto) ──────────────────

export async function reconcileWithInvoice(
  societyId: string,
  transactionId: string,
  invoiceId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const [transaction, invoice, paidAgg] = await Promise.all([
      prisma.bankTransaction.findFirst({
        where: { id: transactionId, bankAccount: { societyId }, isReconciled: false },
      }),
      prisma.invoice.findFirst({ where: { id: invoiceId, societyId } }),
      prisma.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
    ]);
    if (!transaction) return { success: false, error: "Transaction introuvable ou déjà rapprochée" };
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (transaction.amount <= 0) {
      return { success: false, error: "Une facture locataire doit être rapprochée avec une transaction bancaire créditrice" };
    }

    const paidSoFar = paidAgg._sum.amount ?? 0;
    const newTotal = paidSoFar + transaction.amount;
    // Pour les factures en gestion tiers, comparer au montant net attendu
    const targetAmount = invoice.isThirdPartyManaged && invoice.expectedNetAmount
      ? invoice.expectedNetAmount
      : invoice.totalTTC;
    const newStatus = newTotal >= targetAmount - 0.01 ? "PAYE" : "PARTIELLEMENT_PAYE";

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: transaction.amount,
          paidAt: transaction.transactionDate,
          method: "virement",
          reference: transaction.reference ?? undefined,
          isReconciled: true,
        },
      });
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
      await tx.bankReconciliation.create({
        data: {
          transactionId,
          paymentId: payment.id,
          isValidated: true,
          validatedAt: new Date(),
          validatedBy: context.userId,
        },
      });
      const journalEntryId = await createBankJournalEntryForTransaction(
        tx,
        societyId,
        {
          ...transaction,
          reconciliations: [{ payment: { invoice } }],
        },
        { linkTransaction: false }
      );
      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: { isReconciled: true, journalEntryId },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "BankReconciliation",
      entityId: transactionId,
      details: { invoiceId, action: "reconcile_invoice", journalType: "BQUE" },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath("/comptabilite");
    revalidatePath("/facturation");
    revalidatePath("/locataires");
    if (invoice.tenantId) {
      revalidatePath(`/locataires/${invoice.tenantId}`);
    }

    // Génération automatique de quittance si l'appel de loyer est entièrement payé
    if (newStatus === "PAYE" && invoice.invoiceType === "APPEL_LOYER") {
      generateAndSendQuittance(societyId, invoiceId, transaction.transactionDate).catch((err) => {
        console.error("[reconcileWithInvoice] Quittance auto échouée:", err);
      });
    }

    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reconcileWithInvoice]", error);
    return { success: false, error: "Erreur lors du rapprochement" };
  }
}

// ─── Rapprochement avec une échéance de prêt ─────────────────────────────────

export async function reconcileWithLoanLine(
  societyId: string,
  transactionId: string,
  loanLineId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const [transaction, loanLine] = await Promise.all([
      prisma.bankTransaction.findFirst({
        where: { id: transactionId, bankAccount: { societyId }, isReconciled: false },
      }),
      prisma.loanAmortizationLine.findFirst({
        where: { id: loanLineId, loan: { societyId } },
      }),
    ]);
    if (!transaction) return { success: false, error: "Transaction introuvable ou déjà rapprochée" };
    if (!loanLine) return { success: false, error: "Échéance introuvable" };
    if (transaction.amount >= 0) {
      return { success: false, error: "Une échéance de prêt doit être rapprochée avec une transaction bancaire débitrice" };
    }
    const transactionAmount = Math.abs(transaction.amount);
    const tolerance = Math.max(0.01, loanLine.totalPayment * 0.02);
    if (Math.abs(transactionAmount - loanLine.totalPayment) > tolerance) {
      return { success: false, error: "Le montant de la transaction ne correspond pas à l'échéance sélectionnée" };
    }

    await prisma.$transaction(async (tx) => {
      const [compte512, compte164, compte661, compte616] = await Promise.all([
        tx.accountingAccount.upsert({
          where: { societyId_code: { societyId, code: "512" } },
          update: {},
          create: { societyId, code: "512", label: "Banque", type: "5" },
        }),
        tx.accountingAccount.upsert({
          where: { societyId_code: { societyId, code: "164000" } },
          update: {},
          create: { societyId, code: "164000", label: "Emprunts aupres des etablissements de credit", type: "1" },
        }),
        tx.accountingAccount.upsert({
          where: { societyId_code: { societyId, code: "661100" } },
          update: {},
          create: { societyId, code: "661100", label: "Interets des emprunts", type: "6" },
        }),
        tx.accountingAccount.upsert({
          where: { societyId_code: { societyId, code: "616000" } },
          update: {},
          create: { societyId, code: "616000", label: "Primes d'assurance", type: "6" },
        }),
      ]);

      const journalEntry = transaction.journalEntryId
        ? null
        : await tx.journalEntry.create({
            data: {
              societyId,
              fiscalYearId: await resolveOpenFiscalYearIdForDate(tx, societyId, transaction.transactionDate),
              journalType: "BQUE",
              entryDate: transaction.transactionDate,
              label: transaction.label,
              reference: transaction.reference ?? undefined,
              lines: {
                create: [
                  {
                    accountId: compte164.id,
                    debit: roundCents(loanLine.principalPayment),
                    credit: 0,
                    label: "Remboursement capital emprunt",
                  },
                  {
                    accountId: compte661.id,
                    debit: roundCents(loanLine.interestPayment),
                    credit: 0,
                    label: "Intérêts d'emprunt",
                  },
                  ...(loanLine.insurancePayment > 0
                    ? [
                        {
                          accountId: compte616.id,
                          debit: roundCents(loanLine.insurancePayment),
                          credit: 0,
                          label: "Assurance emprunteur",
                        },
                      ]
                    : []),
                  {
                    accountId: compte512.id,
                    debit: 0,
                    credit: transactionAmount,
                    label: transaction.label,
                  },
                ],
              },
            },
          });

      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: {
          isReconciled: true,
          ...(journalEntry ? { journalEntryId: journalEntry.id } : {}),
        },
      });
      await tx.loanAmortizationLine.update({
        where: { id: loanLineId },
        data: { isPaid: true, paidAt: transaction.transactionDate },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LoanAmortizationLine",
      entityId: loanLineId,
      details: { transactionId, action: "reconcile_loan_payment", journalType: "BQUE" },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath("/comptabilite");
    revalidatePath("/emprunts");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reconcileWithLoanLine]", error);
    return { success: false, error: "Erreur lors du rapprochement" };
  }
}
