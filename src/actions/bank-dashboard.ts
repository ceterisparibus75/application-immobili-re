"use server";

import { getOptionalSocietyActionContext } from "@/lib/action-society";
import { prisma } from "@/lib/prisma";

type BankPartnerProvider = "POWENS" | "QONTO" | "MANUAL" | "OTHER";

export type BankPartnerFlow = {
  key: string;
  provider: BankPartnerProvider;
  institutionName: string;
  status: string;
  accountCount: number;
  accountIds: string[];
  totalBalance: number;
  periodCredits: number;
  periodDebits: number;
  periodNet: number;
  transactionCount: number;
  unreconciledCount: number;
  uncategorizedCount: number;
  missingJournalEntryCount: number;
  supplierToPayAmount: number;
  supplierToPayCount: number;
  supplierOverdueAmount: number;
  supplierOverdueCount: number;
  supplierToReconcileAmount: number;
  supplierToReconcileCount: number;
  lastSyncAt: Date | null;
  expiresAt: Date | null;
};

export type BankAccountPilotageRow = {
  id: string;
  bankName: string;
  accountName: string;
  provider: BankPartnerProvider;
  institutionName: string;
  status: string;
  currentBalance: number;
  transactionCount: number;
  periodCredits: number;
  periodDebits: number;
  periodNet: number;
  unreconciledCount: number;
  missingJournalEntryCount: number;
  lastSyncAt: Date | null;
};

export type SupplierPaymentQueueItem = {
  id: string;
  supplierName: string;
  amountTTC: number;
  dueDate: Date | null;
  status: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentExecutedAt: Date | null;
  bankAccountId: string | null;
  needsPayment: boolean;
  needsBankReconciliation: boolean;
};

export type BankAccountingAnomaly = {
  code:
    | "MISSING_BQUE"
    | "UNRECONCILED_TRANSACTION"
    | "UNCATEGORIZED_TRANSACTION"
    | "SUPPLIER_PAYMENT_TO_RECONCILE"
    | "BANK_CONNECTION_ATTENTION"
    | "BANK_ACCOUNTING_DELTA";
  label: string;
  count: number;
  severity: "info" | "warning" | "critical";
};

export type BankOperationsDashboard = {
  periodStart: Date;
  periodEnd: Date;
  kpis: {
    totalBalance: number;
    periodCredits: number;
    periodDebits: number;
    periodNet: number;
    transactionCount: number;
    reconciliationRate: number;
  };
  actionQueues: {
    unreconciledTransactions: number;
    uncategorizedTransactions: number;
    missingBankJournalEntries: number;
    supplierInvoicesToPay: number;
    supplierPaymentsToReconcile: number;
    bankingConnectionsAttention: number;
  };
  partnerFlows: BankPartnerFlow[];
  accountRows: BankAccountPilotageRow[];
  supplierPayments: SupplierPaymentQueueItem[];
  supplierPaymentControl: {
    toPayAmount: number;
    toPayCount: number;
    overdueAmount: number;
    overdueCount: number;
    toReconcileAmount: number;
    toReconcileCount: number;
  };
  accountingControl: {
    bankAccountCount: number;
    bankJournalEntriesCount: number;
    accountingBankBalance: number;
    bankToAccountingDelta: number;
    anomalies: BankAccountingAnomaly[];
  };
};

type DashboardOptions = {
  now?: Date;
  periodDays?: number;
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function addAmount(current: number, amount: number): number {
  return roundCents(current + amount);
}

function getDefaultPeriodStart(now: Date, periodDays: number): Date {
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - periodDays);
  periodStart.setHours(0, 0, 0, 0);
  return periodStart;
}

function normalizeProvider(value: string | null | undefined, hasQontoAccount: boolean, hasPowensAccount: boolean): BankPartnerProvider {
  if (value === "POWENS" || hasPowensAccount) return "POWENS";
  if (value === "QONTO" || hasQontoAccount) return "QONTO";
  if (!value) return "MANUAL";
  return "OTHER";
}

function isConnectionAttention(status: string, expiresAt: Date | null, now: Date): boolean {
  if (status !== "active") return true;
  if (!expiresAt) return false;
  const expiresSoonAt = new Date(now);
  expiresSoonAt.setDate(expiresSoonAt.getDate() + 14);
  return expiresAt.getTime() <= expiresSoonAt.getTime();
}

function upsertAnomaly(
  anomalies: BankAccountingAnomaly[],
  anomaly: BankAccountingAnomaly
): void {
  if (anomaly.count <= 0) return;
  anomalies.push(anomaly);
}

export async function getBankOperationsDashboard(
  societyId: string,
  options: DashboardOptions = {}
): Promise<BankOperationsDashboard | null> {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  const periodEnd = options.now ?? new Date();
  const periodStart = getDefaultPeriodStart(periodEnd, options.periodDays ?? 30);

  const [accounts, transactions, supplierInvoices, bankJournalEntries] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { societyId },
      include: {
        connection: {
          select: {
            id: true,
            provider: true,
            institutionName: true,
            status: true,
            expiresAt: true,
          },
        },
        _count: { select: { transactions: true } },
      },
      orderBy: [{ bankName: "asc" }, { accountName: "asc" }],
    }),
    prisma.bankTransaction.findMany({
      where: {
        bankAccount: { societyId },
        transactionDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        bankAccountId: true,
        amount: true,
        category: true,
        isReconciled: true,
        journalEntryId: true,
        transactionDate: true,
        bankAccount: {
          select: {
            id: true,
            bankName: true,
            accountName: true,
            powensAccountId: true,
            qontoAccountId: true,
            connection: {
              select: {
                id: true,
                provider: true,
                institutionName: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { transactionDate: "desc" },
    }),
    prisma.supplierInvoice.findMany({
      where: {
        societyId,
        status: { in: ["VALIDATED", "PAID"] },
      },
      select: {
        id: true,
        supplierName: true,
        amountTTC: true,
        dueDate: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentExecutedAt: true,
        bankAccountId: true,
        bankJournalEntryId: true,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.journalEntry.findMany({
      where: {
        societyId,
        journalType: "BQUE",
        entryDate: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        journalType: true,
        entryDate: true,
        status: true,
        isValidated: true,
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

  const totalBalance = roundCents(accounts.reduce((sum, account) => sum + account.currentBalance, 0));
  let periodCredits = 0;
  let periodDebits = 0;
  let unreconciledTransactions = 0;
  let uncategorizedTransactions = 0;
  let missingBankJournalEntries = 0;
  const accountStats = new Map<
    string,
    {
      periodCredits: number;
      periodDebits: number;
      transactionCount: number;
      unreconciledCount: number;
      missingJournalEntryCount: number;
    }
  >();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) periodCredits = addAmount(periodCredits, transaction.amount);
    else periodDebits = addAmount(periodDebits, transaction.amount);
    if (!transaction.isReconciled) unreconciledTransactions++;
    if (!transaction.category) uncategorizedTransactions++;
    if (!transaction.journalEntryId) missingBankJournalEntries++;

    const existing = accountStats.get(transaction.bankAccountId) ?? {
      periodCredits: 0,
      periodDebits: 0,
      transactionCount: 0,
      unreconciledCount: 0,
      missingJournalEntryCount: 0,
    };
    existing.transactionCount++;
    if (transaction.amount >= 0) existing.periodCredits = addAmount(existing.periodCredits, transaction.amount);
    else existing.periodDebits = addAmount(existing.periodDebits, transaction.amount);
    if (!transaction.isReconciled) existing.unreconciledCount++;
    if (!transaction.journalEntryId) existing.missingJournalEntryCount++;
    accountStats.set(transaction.bankAccountId, existing);
  }

  const supplierPayments: SupplierPaymentQueueItem[] = supplierInvoices.map((invoice) => {
    const amountTTC = invoice.amountTTC ?? 0;
    const needsPayment =
      invoice.status === "VALIDATED" &&
      (invoice.paymentStatus === null || invoice.paymentStatus === "PENDING");
    const needsBankReconciliation =
      (invoice.status === "PAID" ||
        invoice.paymentStatus === "CONFIRMED" ||
        invoice.paymentStatus === "SUBMITTED") &&
      !invoice.bankJournalEntryId;

    return {
      id: invoice.id,
      supplierName: invoice.supplierName ?? "Fournisseur non renseigné",
      amountTTC,
      dueDate: invoice.dueDate,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      paymentMethod: invoice.paymentMethod,
      paymentExecutedAt: invoice.paymentExecutedAt,
      bankAccountId: invoice.bankAccountId,
      needsPayment,
      needsBankReconciliation,
    };
  });
  const supplierInvoicesToPay = supplierPayments.filter((invoice) => invoice.needsPayment).length;
  const supplierPaymentsToReconcile = supplierPayments.filter((invoice) => invoice.needsBankReconciliation).length;
  const supplierPaymentControl = supplierPayments.reduce(
    (control, invoice) => {
      if (invoice.needsPayment) {
        control.toPayAmount = addAmount(control.toPayAmount, invoice.amountTTC);
        control.toPayCount += 1;
        if (invoice.dueDate && invoice.dueDate.getTime() < periodEnd.getTime()) {
          control.overdueAmount = addAmount(control.overdueAmount, invoice.amountTTC);
          control.overdueCount += 1;
        }
      }
      if (invoice.needsBankReconciliation) {
        control.toReconcileAmount = addAmount(control.toReconcileAmount, invoice.amountTTC);
        control.toReconcileCount += 1;
      }
      return control;
    },
    {
      toPayAmount: 0,
      toPayCount: 0,
      overdueAmount: 0,
      overdueCount: 0,
      toReconcileAmount: 0,
      toReconcileCount: 0,
    }
  );

  const partnerMap = new Map<string, BankPartnerFlow>();
  const accountPartnerKeys = new Map<string, string>();
  const accountRows: BankAccountPilotageRow[] = accounts.map((account) => {
    const provider = normalizeProvider(
      account.connection?.provider,
      Boolean(account.qontoAccountId),
      Boolean(account.powensAccountId)
    );
    const institutionName = account.connection?.institutionName ?? (provider === "MANUAL" ? "Comptes manuels" : account.bankName);
    const key = account.connection?.id ?? provider;
    accountPartnerKeys.set(account.id, key);
    const stats = accountStats.get(account.id) ?? {
      periodCredits: 0,
      periodDebits: 0,
      transactionCount: 0,
      unreconciledCount: 0,
      missingJournalEntryCount: 0,
    };

    const partner = partnerMap.get(key) ?? {
      key,
      provider,
      institutionName,
      status: account.connection?.status ?? "manual",
      accountCount: 0,
      accountIds: [],
      totalBalance: 0,
      periodCredits: 0,
      periodDebits: 0,
      periodNet: 0,
      transactionCount: 0,
      unreconciledCount: 0,
      uncategorizedCount: 0,
      missingJournalEntryCount: 0,
      supplierToPayAmount: 0,
      supplierToPayCount: 0,
      supplierOverdueAmount: 0,
      supplierOverdueCount: 0,
      supplierToReconcileAmount: 0,
      supplierToReconcileCount: 0,
      lastSyncAt: null,
      expiresAt: account.connection?.expiresAt ?? null,
    };
    partner.accountCount++;
    partner.accountIds.push(account.id);
    partner.totalBalance = addAmount(partner.totalBalance, account.currentBalance);
    partner.periodCredits = addAmount(partner.periodCredits, stats.periodCredits);
    partner.periodDebits = addAmount(partner.periodDebits, stats.periodDebits);
    partner.periodNet = addAmount(partner.periodCredits, partner.periodDebits);
    partner.transactionCount += stats.transactionCount;
    partner.unreconciledCount += stats.unreconciledCount;
    partner.missingJournalEntryCount += stats.missingJournalEntryCount;
    partner.lastSyncAt =
      partner.lastSyncAt && account.lastSyncAt
        ? new Date(Math.max(partner.lastSyncAt.getTime(), account.lastSyncAt.getTime()))
        : account.lastSyncAt ?? partner.lastSyncAt;
    partnerMap.set(key, partner);

    return {
      id: account.id,
      bankName: account.bankName,
      accountName: account.accountName,
      provider,
      institutionName,
      status: account.connection?.status ?? "manual",
      currentBalance: account.currentBalance,
      transactionCount: account._count.transactions,
      periodCredits: stats.periodCredits,
      periodDebits: stats.periodDebits,
      periodNet: addAmount(stats.periodCredits, stats.periodDebits),
      unreconciledCount: stats.unreconciledCount,
      missingJournalEntryCount: stats.missingJournalEntryCount,
      lastSyncAt: account.lastSyncAt,
    };
  });

  for (const supplierPayment of supplierPayments) {
    if (!supplierPayment.bankAccountId) continue;
    const partnerKey = accountPartnerKeys.get(supplierPayment.bankAccountId);
    if (!partnerKey) continue;
    const partner = partnerMap.get(partnerKey);
    if (!partner) continue;
    if (supplierPayment.needsPayment) {
      partner.supplierToPayAmount = addAmount(partner.supplierToPayAmount, supplierPayment.amountTTC);
      partner.supplierToPayCount += 1;
      if (supplierPayment.dueDate && supplierPayment.dueDate.getTime() < periodEnd.getTime()) {
        partner.supplierOverdueAmount = addAmount(partner.supplierOverdueAmount, supplierPayment.amountTTC);
        partner.supplierOverdueCount += 1;
      }
    }
    if (supplierPayment.needsBankReconciliation) {
      partner.supplierToReconcileAmount = addAmount(
        partner.supplierToReconcileAmount,
        supplierPayment.amountTTC
      );
      partner.supplierToReconcileCount += 1;
    }
  }

  for (const transaction of transactions) {
    const provider = normalizeProvider(
      transaction.bankAccount.connection?.provider,
      Boolean(transaction.bankAccount.qontoAccountId),
      Boolean(transaction.bankAccount.powensAccountId)
    );
    const key = transaction.bankAccount.connection?.id ?? provider;
    const partner = partnerMap.get(key);
    if (partner && !transaction.category) partner.uncategorizedCount++;
  }

  const bankingConnectionsAttention = Array.from(partnerMap.values()).filter((partner) =>
    partner.provider !== "MANUAL" && isConnectionAttention(partner.status, partner.expiresAt, periodEnd)
  ).length;

  const reconciledCount = transactions.filter((transaction) => transaction.isReconciled).length;
  const reconciliationRate =
    transactions.length === 0 ? 1 : roundCents((reconciledCount / transactions.length) * 100);

  const accountingBankBalance = roundCents(
    bankJournalEntries.reduce((sum, entry) => {
      return sum + entry.lines.reduce((entrySum, line) => {
        if (!line.account.code.startsWith("512")) return entrySum;
        return entrySum + line.debit - line.credit;
      }, 0);
    }, 0)
  );
  const bankToAccountingDelta = roundCents(totalBalance - accountingBankBalance);

  const anomalies: BankAccountingAnomaly[] = [];
  upsertAnomaly(anomalies, {
    code: "MISSING_BQUE",
    label: "Transactions sans écriture BQUE",
    count: missingBankJournalEntries,
    severity: "warning",
  });
  upsertAnomaly(anomalies, {
    code: "UNRECONCILED_TRANSACTION",
    label: "Transactions non rapprochées",
    count: unreconciledTransactions,
    severity: "warning",
  });
  upsertAnomaly(anomalies, {
    code: "UNCATEGORIZED_TRANSACTION",
    label: "Transactions non catégorisées",
    count: uncategorizedTransactions,
    severity: "info",
  });
  upsertAnomaly(anomalies, {
    code: "SUPPLIER_PAYMENT_TO_RECONCILE",
    label: "Paiements fournisseurs à rapprocher",
    count: supplierPaymentsToReconcile,
    severity: "warning",
  });
  upsertAnomaly(anomalies, {
    code: "BANK_CONNECTION_ATTENTION",
    label: "Partenaires bancaires à vérifier",
    count: bankingConnectionsAttention,
    severity: "critical",
  });
  if (Math.abs(bankToAccountingDelta) > 0.01) {
    anomalies.push({
      code: "BANK_ACCOUNTING_DELTA",
      label: "Écart entre solde bancaire et solde comptable 512",
      count: 1,
      severity: "critical",
    });
  }

  return {
    periodStart,
    periodEnd,
    kpis: {
      totalBalance,
      periodCredits,
      periodDebits,
      periodNet: addAmount(periodCredits, periodDebits),
      transactionCount: transactions.length,
      reconciliationRate,
    },
    actionQueues: {
      unreconciledTransactions,
      uncategorizedTransactions,
      missingBankJournalEntries,
      supplierInvoicesToPay,
      supplierPaymentsToReconcile,
      bankingConnectionsAttention,
    },
    partnerFlows: Array.from(partnerMap.values()).sort((a, b) => {
      if (a.provider === "MANUAL" && b.provider !== "MANUAL") return 1;
      if (a.provider !== "MANUAL" && b.provider === "MANUAL") return -1;
      return a.institutionName.localeCompare(b.institutionName);
    }),
    accountRows,
    supplierPayments,
    supplierPaymentControl,
    accountingControl: {
      bankAccountCount: accounts.length,
      bankJournalEntriesCount: bankJournalEntries.length,
      accountingBankBalance,
      bankToAccountingDelta,
      anomalies,
    },
  };
}
