"use server";

import { prisma } from "@/lib/prisma";
import { getOptionalSocietyActionContext } from "@/lib/action-society";
import { getOutstandingAmount } from "@/lib/reports/invoice-metrics";
import {
  computeSuggestionScore,
  findLoanComponentMatch,
  tenantDisplayName,
  type BankReconciliationSuggestion,
  type ReconciliationCandidate,
  type ReconciliationCandidateKind,
} from "@/actions/bank-reconciliation-shared";

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

// ─── Suggestions de rapprochement ───────────────────────────────────────────

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
