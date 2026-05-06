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
  getAccountingFallbackForCashflowCategory,
  type AccountingAccountFallback,
} from "@/lib/accounting-category-mapping";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

type AccountFallback = AccountingAccountFallback;

type AccountingJournalClient = Pick<
  Prisma.TransactionClient,
  "accountingAccount" | "bankTransaction" | "fiscalYear" | "journalEntry"
>;

type BankJournalTransaction = {
  id: string;
  bankAccountId: string;
  amount: number;
  transactionDate: Date;
  label: string;
  reference: string | null;
  category: string | null;
  journalEntryId: string | null;
  bankAccount?: {
    id: string;
    bankName: string;
    accountName: string;
  } | null;
  reconciliations: Array<{
    payment: {
      invoice: {
        isThirdPartyManaged: boolean;
        managementFeeTTC?: number | null;
      } | null;
    } | null;
  }>;
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeAccountLabel(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableNumericSuffix(seed: string, length: number): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const modulo = 10 ** length;
  const value = hash % modulo;
  return String(value === 0 ? 1 : value).padStart(length, "0");
}

function buildAccountingSubAccount(
  prefix: "401" | "512",
  labelPrefix: string,
  displayName: string,
  seed: string,
  type: string
): AccountFallback {
  const normalizedName = normalizeAccountLabel(displayName) || `${labelPrefix} ${seed.slice(-6)}`;
  return {
    code: `${prefix}${stableNumericSuffix(`${prefix}:${seed}:${normalizedName}`, 6)}`,
    label: `${labelPrefix} - ${normalizedName}`,
    type,
  };
}

function buildSupplierAccountFallback(invoice: {
  id: string;
  supplierName: string | null;
  supplierSiret?: string | null;
}): AccountFallback {
  return buildAccountingSubAccount(
    "401",
    "Fournisseur",
    invoice.supplierName ?? invoice.supplierSiret ?? invoice.id,
    invoice.supplierSiret ?? invoice.id,
    "4"
  );
}

function buildBankAccountFallback(bankAccount: {
  id: string;
  bankName?: string | null;
  accountName?: string | null;
}): AccountFallback {
  return buildAccountingSubAccount(
    "512",
    "Banque",
    `${bankAccount.bankName ?? ""} ${bankAccount.accountName ?? ""}`,
    bankAccount.id,
    "5"
  );
}

type LoanPaymentComponent = "principal" | "interest" | "insurance";

type LoanComponentMatch = {
  components: LoanPaymentComponent[];
  isFullInstallment: boolean;
};

type LoanLineReconciliationState = {
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  principalPaidAt: Date | null;
  interestPaidAt: Date | null;
  insurancePaidAt: Date | null;
};

const LOAN_PAYMENT_COMPONENTS: Array<{
  key: LoanPaymentComponent;
  amountField: "principalPayment" | "interestPayment" | "insurancePayment";
  paidAtField: "principalPaidAt" | "interestPaidAt" | "insurancePaidAt";
}> = [
  { key: "principal", amountField: "principalPayment", paidAtField: "principalPaidAt" },
  { key: "interest", amountField: "interestPayment", paidAtField: "interestPaidAt" },
  { key: "insurance", amountField: "insurancePayment", paidAtField: "insurancePaidAt" },
];

function isPositiveAccountingAmount(value: number): boolean {
  return roundCents(value) > 0.01;
}

function amountMatches(actual: number, expected: number): boolean {
  const expectedRounded = roundCents(expected);
  const tolerance = Math.max(0.01, expectedRounded * 0.02);
  return Math.abs(roundCents(actual) - expectedRounded) <= tolerance;
}

function findLoanComponentMatch(
  loanLine: LoanLineReconciliationState,
  transactionAmount: number
): LoanComponentMatch | null {
  const requiredComponents = LOAN_PAYMENT_COMPONENTS.filter((component) =>
    isPositiveAccountingAmount(loanLine[component.amountField])
  );
  const hasComponentAlreadyPaid = requiredComponents.some((component) =>
    Boolean(loanLine[component.paidAtField])
  );

  if (!hasComponentAlreadyPaid && amountMatches(transactionAmount, loanLine.totalPayment)) {
    return { components: requiredComponents.map((component) => component.key), isFullInstallment: true };
  }

  for (const component of requiredComponents) {
    if (!loanLine[component.paidAtField] && amountMatches(transactionAmount, loanLine[component.amountField])) {
      return { components: [component.key], isFullInstallment: false };
    }
  }

  const interestAndInsurance: LoanPaymentComponent[] = ["interest", "insurance"];
  const canMatchInterestAndInsurance = interestAndInsurance.every((component) => {
    const meta = LOAN_PAYMENT_COMPONENTS.find((item) => item.key === component);
    return meta && isPositiveAccountingAmount(loanLine[meta.amountField]) && !loanLine[meta.paidAtField];
  });
  const interestInsuranceAmount = loanLine.interestPayment + loanLine.insurancePayment;
  if (canMatchInterestAndInsurance && amountMatches(transactionAmount, interestInsuranceAmount)) {
    return { components: interestAndInsurance, isFullInstallment: false };
  }

  return null;
}

function isLoanLineFullyPaidAfterMatch(
  loanLine: LoanLineReconciliationState,
  match: LoanComponentMatch
): boolean {
  return LOAN_PAYMENT_COMPONENTS.every((component) => {
    if (!isPositiveAccountingAmount(loanLine[component.amountField])) return true;
    return Boolean(loanLine[component.paidAtField]) || match.components.includes(component.key);
  });
}

async function upsertAccountingAccount(
  client: Pick<Prisma.TransactionClient, "accountingAccount">,
  societyId: string,
  fallback: AccountFallback
) {
  return client.accountingAccount.upsert({
    where: { societyId_code: { societyId, code: fallback.code } },
    update: { isActive: true },
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
    : getAccountingFallbackForCashflowCategory(transaction.category);

  const bankAccountFallback = transaction.bankAccount
    ? buildBankAccountFallback(transaction.bankAccount)
    : { code: "512000", label: "Banques", type: "5" };

  const [compte512, compte411, compte658, compte622, categoryContraAccount] = await Promise.all([
    upsertAccountingAccount(client, societyId, bankAccountFallback),
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
        include: {
          bankAccount: {
            select: { id: true, bankName: true, accountName: true },
          },
        },
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
        isReconciled: false,
        bankAccount: { societyId },
      },
      include: {
        bankAccount: {
          select: { id: true, bankName: true, accountName: true },
        },
      },
    });
    if (!transaction) return { success: false, error: "Transaction introuvable ou déjà rapprochée" };
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
      include: { transaction: { include: { journalEntry: true } } },
    });
    if (!reconciliation) return { success: false, error: "Rapprochement introuvable" };

    if (
      reconciliation.transaction.journalEntry &&
      (reconciliation.transaction.journalEntry.isValidated || reconciliation.transaction.journalEntry.status !== "BROUILLON")
    ) {
      return { success: false, error: "Impossible d'annuler un rapprochement dont l'écriture comptable est validée" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.bankReconciliation.delete({ where: { id: reconciliationId } });
      await tx.bankTransaction.update({
        where: { id: reconciliation.transactionId },
        data: { isReconciled: false, journalEntryId: null },
      });
      await tx.payment.update({
        where: { id: reconciliation.paymentId },
        data: { isReconciled: false },
      });
      if (reconciliation.transaction.journalEntryId) {
        await tx.journalEntry.delete({ where: { id: reconciliation.transaction.journalEntryId } });
      }
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "BankReconciliation",
      entityId: reconciliationId,
    });

    revalidatePath(`/banque/${reconciliation.transaction.bankAccountId}/rapprochement`);
    revalidatePath(`/banque/${reconciliation.transaction.bankAccountId}`);
    revalidatePath("/comptabilite");
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
    if (Math.abs(transaction.amount) <= 0.01) {
      return { success: false, error: "Impossible de générer une écriture bancaire pour un montant nul" };
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

export async function generateMissingBankJournalEntries(
  societyId: string,
  bankAccountId?: string
): Promise<ActionResult<{ generated: number; skipped: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        ...(bankAccountId ? { bankAccountId } : {}),
        journalEntryId: null,
        bankAccount: { societyId },
      },
      include: {
        reconciliations: {
          include: {
            payment: { include: { invoice: true } },
          },
        },
        bankAccount: true,
      },
      orderBy: { transactionDate: "asc" },
      take: 250,
    });

    let generated = 0;
    let skipped = 0;

    for (const transaction of transactions) {
      if (Math.abs(transaction.amount) <= 0.01) {
        skipped += 1;
        continue;
      }

      await createBankJournalEntryForTransaction(prisma, societyId, transaction);
      generated += 1;
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: bankAccountId ?? "missing-bank-journal-entries",
      details: {
        action: "bulk_generate_missing_bque",
        bankAccountId: bankAccountId ?? null,
        generated,
        skipped,
        scanned: transactions.length,
      },
    });

    revalidatePath("/banque");
    revalidatePath("/banque/controle-comptable");
    revalidatePath("/comptabilite");
    if (bankAccountId) {
      revalidatePath(`/banque/${bankAccountId}`);
      revalidatePath(`/banque/${bankAccountId}/rapprochement`);
    }

    return { success: true, data: { generated, skipped } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[generateMissingBankJournalEntries]", error);
    return { success: false, error: "Erreur lors de la génération des écritures BQUE manquantes" };
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
      dueDate: { lte: new Date() },
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
      principalPaidAt: true,
      interestPaidAt: true,
      insurancePaidAt: true,
      principalBankTransactionId: true,
      interestBankTransactionId: true,
      insuranceBankTransactionId: true,
      loan: { select: { id: true, label: true, lender: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

// ─── Factures fournisseurs à rapprocher ─────────────────────────────────────

export async function getSupplierInvoicesToReconcile(societyId: string) {
  if (!(await getOptionalSocietyActionContext(societyId))) return [];

  return prisma.supplierInvoice.findMany({
    where: {
      societyId,
      status: { in: ["VALIDATED", "PAID"] },
      bankJournalEntryId: null,
      amountTTC: { not: null },
    },
    select: {
      id: true,
      supplierName: true,
      amountTTC: true,
      dueDate: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentReference: true,
      bankAccountId: true,
      bankJournalEntryId: true,
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

// ─── Rapprochement avec une facture fournisseur ─────────────────────────────

export async function reconcileWithSupplierInvoice(
  societyId: string,
  transactionId: string,
  supplierInvoiceId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const [transaction, invoice] = await Promise.all([
      prisma.bankTransaction.findFirst({
        where: { id: transactionId, bankAccount: { societyId }, isReconciled: false },
        include: {
          bankAccount: {
            select: { id: true, bankName: true, accountName: true },
          },
        },
      }),
      prisma.supplierInvoice.findFirst({
        where: { id: supplierInvoiceId, societyId },
      }),
    ]);
    if (!transaction) return { success: false, error: "Transaction introuvable ou déjà rapprochée" };
    if (!invoice) return { success: false, error: "Facture fournisseur introuvable" };
    if (transaction.amount >= 0) {
      return { success: false, error: "Une facture fournisseur doit être rapprochée avec une transaction bancaire débitrice" };
    }
    if (invoice.amountTTC == null || Math.abs(Math.abs(transaction.amount) - invoice.amountTTC) > 0.01) {
      return { success: false, error: "Le montant de la transaction ne correspond pas à la facture fournisseur sélectionnée" };
    }
    if (invoice.bankJournalEntryId) {
      const existingLinkedTransaction = await prisma.bankTransaction.findFirst({
        where: {
          journalEntryId: invoice.bankJournalEntryId,
          bankAccount: { societyId },
          id: { not: transactionId },
        },
        select: { id: true },
      });
      if (existingLinkedTransaction) {
        return { success: false, error: "Cette facture fournisseur est déjà rapprochée avec une autre transaction bancaire" };
      }
    }

    await prisma.$transaction(async (tx) => {
      let journalEntryId = transaction.journalEntryId ?? invoice.bankJournalEntryId;

      if (!journalEntryId) {
        const [compte401, compte512] = await Promise.all([
          upsertAccountingAccount(tx, societyId, buildSupplierAccountFallback(invoice)),
          upsertAccountingAccount(
            tx,
            societyId,
            transaction.bankAccount
              ? buildBankAccountFallback(transaction.bankAccount)
              : { code: "512000", label: "Banques", type: "5" }
          ),
        ]);

        const amount = roundCents(Math.abs(transaction.amount));
        const entry = await tx.journalEntry.create({
          data: {
            societyId,
            fiscalYearId: await resolveOpenFiscalYearIdForDate(tx, societyId, transaction.transactionDate),
            journalType: "BQUE",
            entryDate: transaction.transactionDate,
            piece: transaction.reference ?? undefined,
            label: `Règlement fournisseur - ${invoice.supplierName ?? transaction.label}`,
            reference: transaction.reference ?? undefined,
            status: "BROUILLON",
            lines: {
              create: [
                {
                  accountId: compte401.id,
                  debit: amount,
                  credit: 0,
                  label: invoice.supplierName ?? transaction.label,
                },
                {
                  accountId: compte512.id,
                  debit: 0,
                  credit: amount,
                  label: transaction.label,
                },
              ],
            },
          },
        });
        journalEntryId = entry.id;
      }

      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: { isReconciled: true, journalEntryId },
      });
      if (invoice.chargeId) {
        await tx.charge.update({
          where: { id: invoice.chargeId },
          data: { isPaid: true },
        });
      }
      await tx.supplierInvoice.update({
        where: { id: supplierInvoiceId },
        data: {
          status: "PAID",
          paymentStatus: "CONFIRMED",
          paymentExecutedAt: transaction.transactionDate,
          paymentReference: transaction.reference ?? invoice.paymentReference,
          bankAccountId: transaction.bankAccountId,
          bankJournalEntryId: journalEntryId,
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: supplierInvoiceId,
      details: {
        action: "reconcile_supplier_invoice",
        transactionId,
        journalType: "BQUE",
      },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${transaction.bankAccountId}`);
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath("/banque/factures-fournisseurs");
    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reconcileWithSupplierInvoice]", error);
    return { success: false, error: "Erreur lors du rapprochement fournisseur" };
  }
}

// ─── Reprises de solde à rapprocher ──────────────────────────────────────────

export async function getUnreconciledBalanceAdjustments(societyId: string) {
  if (!(await getOptionalSocietyActionContext(societyId))) return [];

  return prisma.tenantBalanceAdjustment.findMany({
    where: {
      societyId,
      isReconciled: false,
      amount: { gt: 0 },
    },
    select: {
      id: true,
      label: true,
      amount: true,
      dueDate: true,
      reference: true,
      periodLabel: true,
      tenant: { select: { companyName: true, firstName: true, lastName: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function reconcileWithBalanceAdjustment(
  societyId: string,
  transactionId: string,
  adjustmentId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const [transaction, adjustment] = await Promise.all([
      prisma.bankTransaction.findFirst({
        where: { id: transactionId, bankAccount: { societyId }, isReconciled: false },
        include: { bankAccount: { select: { id: true, bankName: true, accountName: true } } },
      }),
      prisma.tenantBalanceAdjustment.findFirst({
        where: { id: adjustmentId, societyId, isReconciled: false },
        include: { tenant: { select: { companyName: true, firstName: true, lastName: true } } },
      }),
    ]);

    if (!transaction) return { success: false, error: "Transaction introuvable ou déjà rapprochée" };
    if (!adjustment) return { success: false, error: "Reprise de solde introuvable" };
    if (transaction.amount <= 0) {
      return { success: false, error: "Une reprise de solde doit être rapprochée avec une transaction bancaire créditrice" };
    }
    if (Math.abs(transaction.amount - adjustment.amount) > 0.01) {
      return { success: false, error: "Le montant de la transaction ne correspond pas à la reprise de solde" };
    }

    await prisma.$transaction(async (tx) => {
      const bankAccountFallback = transaction.bankAccount
        ? buildBankAccountFallback(transaction.bankAccount)
        : { code: "512000", label: "Banques", type: "5" };

      const [compte512, compte411] = await Promise.all([
        upsertAccountingAccount(tx, societyId, bankAccountFallback),
        upsertAccountingAccount(tx, societyId, { code: "411", label: "Clients", type: "4" }),
      ]);

      const amount = roundCents(transaction.amount);
      const name = tenantDisplayName(adjustment.tenant);

      const entry = await tx.journalEntry.create({
        data: {
          societyId,
          fiscalYearId: await resolveOpenFiscalYearIdForDate(tx, societyId, transaction.transactionDate),
          journalType: "BQUE",
          entryDate: transaction.transactionDate,
          label: `${adjustment.label} - ${name}`,
          reference: transaction.reference ?? undefined,
          lines: {
            create: [
              { accountId: compte512.id, debit: amount, credit: 0, label: transaction.label },
              { accountId: compte411.id, debit: 0, credit: amount, label: name },
            ],
          },
        },
      });

      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: { isReconciled: true, journalEntryId: entry.id },
      });

      await tx.tenantBalanceAdjustment.update({
        where: { id: adjustmentId },
        data: {
          isReconciled: true,
          reconciledAt: new Date(),
          reconciledBankTransactionId: transactionId,
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "TenantBalanceAdjustment",
      entityId: adjustmentId,
      details: { transactionId, action: "reconcile_balance_adjustment", journalType: "BQUE" },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath("/comptabilite");
    revalidatePath("/locataires");

    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reconcileWithBalanceAdjustment]", error);
    return { success: false, error: "Erreur lors du rapprochement" };
  }
}

// ─── Suggestions de rapprochement ───────────────────────────────────────────

export type ReconciliationCandidateKind =
  | "payment"
  | "invoice"
  | "loanLine"
  | "supplierInvoice"
  | "journalEntry"
  | "balanceAdjustment";

export type ReconciliationCandidate = {
  kind: ReconciliationCandidateKind;
  targetId: string;
  label: string;
  amount: number;
  date: Date | null;
  score: number;
  reason: string;
};

export type BankReconciliationSuggestion = {
  transactionId: string;
  candidates: ReconciliationCandidate[];
  bestCandidate: ReconciliationCandidate | null;
};

function normalizeMatchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function daysBetween(left: Date, right: Date | null): number {
  if (!right) return 99;
  return Math.abs(left.getTime() - right.getTime()) / (1000 * 60 * 60 * 24);
}

function computeSuggestionScore(input: {
  transactionAmount: number;
  candidateAmount: number;
  transactionDate: Date;
  candidateDate: Date | null;
  transactionLabel: string;
  candidateLabel: string;
  expectedDirection: "credit" | "debit" | "any";
}): { score: number; reason: string } {
  const transactionAbs = Math.abs(input.transactionAmount);
  const candidateAbs = Math.abs(input.candidateAmount);
  const amountDelta = Math.abs(transactionAbs - candidateAbs);
  const dateDelta = daysBetween(input.transactionDate, input.candidateDate);
  const txText = normalizeMatchText(input.transactionLabel);
  const candidateText = normalizeMatchText(input.candidateLabel);
  const directionMatches =
    input.expectedDirection === "any" ||
    (input.expectedDirection === "credit" && input.transactionAmount > 0) ||
    (input.expectedDirection === "debit" && input.transactionAmount < 0);

  let score = 0;
  const reasons: string[] = [];
  if (directionMatches) {
    score += 10;
    reasons.push(input.expectedDirection === "debit" ? "débit compatible" : input.expectedDirection === "credit" ? "crédit compatible" : "sens compatible");
  }
  if (amountDelta <= 0.01) {
    score += 60;
    reasons.push("montant exact");
  } else if (amountDelta <= Math.max(1, candidateAbs * 0.02)) {
    score += 40;
    reasons.push("montant proche");
  }
  if (dateDelta <= 1) {
    score += 20;
    reasons.push("date proche");
  } else if (dateDelta <= 7) {
    score += 10;
    reasons.push("période proche");
  }
  if (candidateText && txText.includes(candidateText)) {
    score += 10;
    reasons.push("libellé reconnu");
  } else if (candidateText && candidateText.split(" ").some((part) => part.length >= 4 && txText.includes(part))) {
    score += 6;
    reasons.push("mot-clé reconnu");
  }

  return { score: Math.min(100, score), reason: reasons.join(", ") || "candidat possible" };
}

function tenantDisplayName(tenant: { companyName: string | null; firstName: string | null; lastName: string | null } | null): string {
  if (!tenant) return "Locataire non renseigné";
  return tenant.companyName ?? (`${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "Locataire non renseigné");
}

export async function getBankReconciliationSuggestions(
  societyId: string,
  bankAccountId: string
): Promise<BankReconciliationSuggestion[]> {
  if (!(await getOptionalSocietyActionContext(societyId))) return [];

  const [transactions, payments, invoices, supplierInvoices, loanLines, journalEntries, balanceAdjustments] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        isReconciled: false,
        bankAccount: { societyId },
      },
      select: {
        id: true,
        amount: true,
        label: true,
        transactionDate: true,
      },
      orderBy: { transactionDate: "desc" },
      take: 100,
    }),
    prisma.payment.findMany({
      where: {
        isReconciled: false,
        invoice: { societyId },
      },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        reference: true,
        invoice: {
          select: {
            tenant: { select: { companyName: true, firstName: true, lastName: true } },
          },
        },
      },
      take: 200,
    }),
    prisma.invoice.findMany({
      where: {
        societyId,
        invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
        status: { in: ["VALIDEE", "ENVOYEE", "EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE", "RELANCEE", "LITIGIEUX"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalTTC: true,
        dueDate: true,
        status: true,
        payments: { select: { amount: true } },
        tenant: { select: { companyName: true, firstName: true, lastName: true } },
      },
      take: 200,
    }),
    prisma.supplierInvoice.findMany({
      where: {
        societyId,
        status: { in: ["VALIDATED", "PAID"] },
        bankJournalEntryId: null,
        amountTTC: { not: null },
      },
      select: {
        id: true,
        supplierName: true,
        amountTTC: true,
        dueDate: true,
        status: true,
        paymentReference: true,
      },
      take: 200,
    }),
    prisma.loanAmortizationLine.findMany({
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
        principalPaidAt: true,
        interestPaidAt: true,
        insurancePaidAt: true,
        loan: { select: { id: true, label: true, lender: true } },
      },
      take: 200,
    }),
    prisma.journalEntry.findMany({
      where: {
        societyId,
        journalType: "BQUE",
        bankTransaction: null,
      },
      select: {
        id: true,
        label: true,
        entryDate: true,
        reference: true,
        lines: {
          select: {
            debit: true,
            credit: true,
            account: { select: { code: true, label: true } },
          },
        },
      },
      take: 200,
    }),
    prisma.tenantBalanceAdjustment.findMany({
      where: { societyId, isReconciled: false, amount: { gt: 0 } },
      select: {
        id: true,
        label: true,
        amount: true,
        dueDate: true,
        tenant: { select: { companyName: true, firstName: true, lastName: true } },
      },
      take: 200,
    }),
  ]);

  return transactions.map((transaction) => {
    const candidates: ReconciliationCandidate[] = [];
    const addCandidate = (
      kind: ReconciliationCandidateKind,
      targetId: string,
      label: string,
      amount: number,
      date: Date | null,
      expectedDirection: "credit" | "debit" | "any"
    ) => {
      const { score, reason } = computeSuggestionScore({
        transactionAmount: transaction.amount,
        candidateAmount: amount,
        transactionDate: transaction.transactionDate,
        candidateDate: date,
        transactionLabel: transaction.label,
        candidateLabel: label,
        expectedDirection,
      });
      if (score >= 55) candidates.push({ kind, targetId, label, amount, date, score, reason });
    };

    for (const payment of payments) {
      addCandidate("payment", payment.id, tenantDisplayName(payment.invoice.tenant), payment.amount, payment.paidAt, "credit");
    }
    for (const invoice of invoices) {
      const amount = getOutstandingAmount(invoice);
      addCandidate(
        "invoice",
        invoice.id,
        `${invoice.invoiceNumber ?? "Facture"} ${tenantDisplayName(invoice.tenant)}`,
        amount,
        invoice.dueDate,
        "credit"
      );
    }
    for (const supplierInvoice of supplierInvoices) {
      addCandidate(
        "supplierInvoice",
        supplierInvoice.id,
        supplierInvoice.supplierName ?? supplierInvoice.paymentReference ?? "Facture fournisseur",
        supplierInvoice.amountTTC ?? 0,
        supplierInvoice.dueDate,
        "debit"
      );
    }
    for (const loanLine of loanLines) {
      const match = transaction.amount < 0 ? findLoanComponentMatch(loanLine, Math.abs(transaction.amount)) : null;
      if (match) {
        addCandidate(
          "loanLine",
          loanLine.id,
          `${loanLine.loan.label} échéance ${loanLine.period}`,
          Math.abs(transaction.amount),
          loanLine.dueDate,
          "debit"
        );
      }
    }
    for (const entry of journalEntries) {
      const bankAmount = entry.lines.reduce((sum, line) => {
        if (!line.account.code.startsWith("512")) return sum;
        return sum + line.debit - line.credit;
      }, 0);
      addCandidate("journalEntry", entry.id, entry.label, bankAmount, entry.entryDate, "any");
    }
    for (const adj of balanceAdjustments) {
      addCandidate(
        "balanceAdjustment",
        adj.id,
        `Reprise - ${tenantDisplayName(adj.tenant)}${adj.label ? " · " + adj.label : ""}`,
        adj.amount,
        adj.dueDate,
        "credit"
      );
    }

    const sortedCandidates = candidates.sort((a, b) => b.score - a.score).slice(0, 5);
    return {
      transactionId: transaction.id,
      candidates: sortedCandidates,
      bestCandidate: sortedCandidates[0] ?? null,
    };
  });
}

// ─── Rapprochement avec une écriture BQUE existante ─────────────────────────

export async function reconcileWithJournalEntry(
  societyId: string,
  transactionId: string,
  journalEntryId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const [transaction, journalEntry] = await Promise.all([
      prisma.bankTransaction.findFirst({
        where: { id: transactionId, bankAccount: { societyId }, isReconciled: false },
      }),
      prisma.journalEntry.findFirst({
        where: { id: journalEntryId, societyId, journalType: "BQUE" },
        include: {
          bankTransaction: { select: { id: true } },
          lines: {
            select: {
              debit: true,
              credit: true,
              account: { select: { code: true, label: true } },
            },
          },
        },
      }),
    ]);

    if (!transaction) return { success: false, error: "Transaction introuvable ou déjà rapprochée" };
    if (!journalEntry) return { success: false, error: "Écriture BQUE introuvable" };
    if (journalEntry.bankTransaction) {
      return { success: false, error: "Cette écriture BQUE est déjà liée à une transaction bancaire" };
    }
    if (journalEntry.isValidated || journalEntry.status !== "BROUILLON") {
      return { success: false, error: "Seules les écritures BQUE en brouillon peuvent être rapprochées" };
    }

    const bankAmount = roundCents(
      journalEntry.lines.reduce((sum, line) => {
        if (!line.account.code.startsWith("512")) return sum;
        return sum + line.debit - line.credit;
      }, 0)
    );
    if (Math.abs(bankAmount - roundCents(transaction.amount)) > 0.01) {
      return { success: false, error: "Le montant banque de l'écriture BQUE ne correspond pas à la transaction" };
    }

    await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: { isReconciled: true, journalEntryId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "BankTransaction",
      entityId: transactionId,
      details: {
        action: "reconcile_journal_entry",
        journalEntryId,
        journalType: "BQUE",
      },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${transaction.bankAccountId}`);
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reconcileWithJournalEntry]", error);
    return { success: false, error: "Erreur lors du rapprochement avec l'écriture BQUE" };
  }
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
        where: { id: loanLineId, isPaid: false, loan: { societyId } },
      }),
    ]);
    if (!transaction) return { success: false, error: "Transaction introuvable ou déjà rapprochée" };
    if (!loanLine) return { success: false, error: "Échéance introuvable" };
    if (transaction.amount >= 0) {
      return { success: false, error: "Une échéance de prêt doit être rapprochée avec une transaction bancaire débitrice" };
    }
    const transactionAmount = Math.abs(transaction.amount);
    const match = findLoanComponentMatch(loanLine, transactionAmount);
    if (!match) {
      return {
        success: false,
        error: "Le montant de la transaction ne correspond ni au total ni à un composant non rapproché de l'échéance (capital, intérêts, assurance)",
      };
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

      const journalLines = [
        ...(match.components.includes("principal")
          ? [
              {
                accountId: compte164.id,
                debit: roundCents(loanLine.principalPayment),
                credit: 0,
                label: "Remboursement capital emprunt",
              },
            ]
          : []),
        ...(match.components.includes("interest")
          ? [
              {
                accountId: compte661.id,
                debit: roundCents(loanLine.interestPayment),
                credit: 0,
                label: "Intérêts d'emprunt",
              },
            ]
          : []),
        ...(match.components.includes("insurance")
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
          credit: roundCents(transactionAmount),
          label: transaction.label,
        },
      ];

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
                create: journalLines,
              },
            },
          });

      const isPaid = isLoanLineFullyPaidAfterMatch(loanLine, match);
      const updateData: {
        principalPaidAt?: Date;
        interestPaidAt?: Date;
        insurancePaidAt?: Date;
        principalBankTransactionId?: string;
        interestBankTransactionId?: string;
        insuranceBankTransactionId?: string;
        isPaid: boolean;
        paidAt: Date | null;
      } = {
        isPaid,
        paidAt: isPaid ? transaction.transactionDate : null,
      };
      if (match.components.includes("principal")) {
        updateData.principalPaidAt = transaction.transactionDate;
        updateData.principalBankTransactionId = transactionId;
      }
      if (match.components.includes("interest")) {
        updateData.interestPaidAt = transaction.transactionDate;
        updateData.interestBankTransactionId = transactionId;
      }
      if (match.components.includes("insurance")) {
        updateData.insurancePaidAt = transaction.transactionDate;
        updateData.insuranceBankTransactionId = transactionId;
      }

      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: {
          isReconciled: true,
          ...(journalEntry ? { journalEntryId: journalEntry.id } : {}),
        },
      });
      await tx.loanAmortizationLine.update({
        where: { id: loanLineId },
        data: updateData,
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LoanAmortizationLine",
      entityId: loanLineId,
      details: {
        transactionId,
        action: "reconcile_loan_payment",
        journalType: "BQUE",
        components: match.components,
        isFullInstallment: match.isFullInstallment,
      },
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
