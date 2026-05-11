// Helpers privés, types et fonctions partagées — pas de "use server"
// (importé par bank-reconciliation-queries / -mutations).

import { prisma } from "@/lib/prisma";
import { resolveOpenFiscalYearIdForDate } from "@/lib/accounting-period";
import type { Prisma } from "@/generated/prisma/client";
import {
  getAccountingFallbackForCashflowCategory,
  type AccountingAccountFallback,
} from "@/lib/accounting-category-mapping";

// ============================================================
// TYPES
// ============================================================

export type AccountFallback = AccountingAccountFallback;

export type AccountingJournalClient = Pick<
  Prisma.TransactionClient,
  "accountingAccount" | "bankTransaction" | "fiscalYear" | "journalEntry"
>;

export type BankJournalTransaction = {
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

export type LoanPaymentComponent = "principal" | "interest" | "insurance";

export type LoanComponentMatch = {
  components: LoanPaymentComponent[];
  isFullInstallment: boolean;
};

export type LoanLineReconciliationState = {
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  principalPaidAt: Date | null;
  interestPaidAt: Date | null;
  insurancePaidAt: Date | null;
};

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

// ============================================================
// CONSTANTES
// ============================================================

export const LOAN_PAYMENT_COMPONENTS: Array<{
  key: LoanPaymentComponent;
  amountField: "principalPayment" | "interestPayment" | "insurancePayment";
  paidAtField: "principalPaidAt" | "interestPaidAt" | "insurancePaidAt";
}> = [
  { key: "principal", amountField: "principalPayment", paidAtField: "principalPaidAt" },
  { key: "interest", amountField: "interestPayment", paidAtField: "interestPaidAt" },
  { key: "insurance", amountField: "insurancePayment", paidAtField: "insurancePaidAt" },
];

// ============================================================
// HELPERS PURS
// ============================================================

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeAccountLabel(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stableNumericSuffix(seed: string, length: number): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const modulo = 10 ** length;
  const value = hash % modulo;
  return String(value === 0 ? 1 : value).padStart(length, "0");
}

export function buildAccountingSubAccount(
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

export function buildSupplierAccountFallback(invoice: {
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

export function buildBankAccountFallback(bankAccount: {
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

export function isPositiveAccountingAmount(value: number): boolean {
  return roundCents(value) > 0.01;
}

export function amountMatches(actual: number, expected: number): boolean {
  const expectedRounded = roundCents(expected);
  const tolerance = Math.max(0.01, expectedRounded * 0.02);
  return Math.abs(roundCents(actual) - expectedRounded) <= tolerance;
}

export function findLoanComponentMatch(
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

export function isLoanLineFullyPaidAfterMatch(
  loanLine: LoanLineReconciliationState,
  match: LoanComponentMatch
): boolean {
  return LOAN_PAYMENT_COMPONENTS.every((component) => {
    if (!isPositiveAccountingAmount(loanLine[component.amountField])) return true;
    return Boolean(loanLine[component.paidAtField]) || match.components.includes(component.key);
  });
}

export function tenantDisplayName(
  tenant: { companyName: string | null; firstName: string | null; lastName: string | null } | null
): string {
  if (!tenant) return "Locataire non renseigné";
  return tenant.companyName ?? (`${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "Locataire non renseigné");
}

export function normalizeMatchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function daysBetween(left: Date, right: Date | null): number {
  if (!right) return 99;
  return Math.abs(left.getTime() - right.getTime()) / (1000 * 60 * 60 * 24);
}

export function computeSuggestionScore(input: {
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

// ============================================================
// HELPERS PRISMA (IO)
// ============================================================

export async function upsertAccountingAccount(
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

export async function createBankJournalEntryForTransaction(
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

export async function createReconciliationRecord(
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
