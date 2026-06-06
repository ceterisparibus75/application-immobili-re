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
import {
  suggestAllocations,
  type SuggestedAllocation,
} from "@/lib/invoice-allocation-suggest";

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
      // Exclut les lignes techniques (cap + int + ass = 0) — typiquement issues
      // d'un import PDF où une colonne du tableau n'a pas été extraite.
      OR: [
        { principalPayment: { gt: 0.01 } },
        { interestPayment: { gt: 0.01 } },
        { insurancePayment: { gt: 0.01 } },
      ],
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
        // Idem getUpcomingLoanLines : on ignore les lignes sans rien à payer.
        OR: [
          { principalPayment: { gt: 0.01 } },
          { interestPayment: { gt: 0.01 } },
          { insurancePayment: { gt: 0.01 } },
        ],
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

// ─── Données pour la ventilation d'un virement sur plusieurs factures ─────────

export interface AllocationCandidateInvoice {
  id: string;
  invoiceNumber: string | null;
  invoiceType: string;
  totalTTC: number;
  paidSoFar: number;
  remaining: number;
  dueDate: Date;
  status: string;
}

export interface AllocationTenantGroup {
  tenantId: string;
  tenantLabel: string;
  invoices: AllocationCandidateInvoice[];
  /** Combinaisons suggérées de factures pour ce locataire (target = transaction.amount). */
  suggestions: SuggestedAllocation[];
}

export interface AllocationContext {
  transactionId: string;
  transactionAmount: number;
  transactionLabel: string;
  transactionDate: Date;
  /** Total déjà ventilé sur la transaction. */
  alreadyAllocated: number;
  /** Reste à ventiler. */
  remaining: number;
  groups: AllocationTenantGroup[];
}

/**
 * Retourne, pour une transaction donnée, les locataires candidats à la
 * ventilation (= locataires ayant des factures impayées), leurs factures et
 * une liste de suggestions automatiques de combinaisons exactes.
 *
 * Limite par défaut : 100 factures impayées les plus anciennes par locataire.
 */
export async function getAllocationContextForTransaction(
  societyId: string,
  transactionId: string,
): Promise<AllocationContext | null> {
  if (!(await getOptionalSocietyActionContext(societyId))) return null;

  const transaction = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, bankAccount: { societyId } },
    select: {
      id: true,
      amount: true,
      label: true,
      transactionDate: true,
      reconciliations: { select: { amount: true } },
    },
  });
  if (!transaction) return null;
  if (transaction.amount <= 0) return null;

  const alreadyAllocated = round2(
    transaction.reconciliations.reduce((s, r) => s + r.amount, 0),
  );
  const remaining = round2(transaction.amount - alreadyAllocated);

  if (remaining <= 0.01) {
    return {
      transactionId: transaction.id,
      transactionAmount: transaction.amount,
      transactionLabel: transaction.label,
      transactionDate: transaction.transactionDate,
      alreadyAllocated,
      remaining: 0,
      groups: [],
    };
  }

  const pendingInvoices = await prisma.invoice.findMany({
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
      tenantId: true,
      payments: { select: { amount: true } },
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 500,
  });

  const groupsByTenant = new Map<string, AllocationTenantGroup>();
  for (const inv of pendingInvoices) {
    const paidSoFar = inv.payments.reduce((s, p) => s + (p.amount ?? 0), 0);
    const remainingInv = round2(inv.totalTTC - paidSoFar);
    if (remainingInv <= 0.01) continue;

    if (!groupsByTenant.has(inv.tenantId)) {
      groupsByTenant.set(inv.tenantId, {
        tenantId: inv.tenantId,
        tenantLabel: tenantDisplayName({
          companyName: inv.tenant.companyName,
          firstName: inv.tenant.firstName,
          lastName: inv.tenant.lastName,
        }),
        invoices: [],
        suggestions: [],
      });
    }
    groupsByTenant.get(inv.tenantId)!.invoices.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType,
      totalTTC: inv.totalTTC,
      paidSoFar: round2(paidSoFar),
      remaining: remainingInv,
      dueDate: inv.dueDate,
      status: inv.status,
    });
  }

  // Calcul des suggestions auto-match par locataire
  for (const group of groupsByTenant.values()) {
    group.suggestions = suggestAllocations(
      remaining,
      group.invoices.map((i) => ({
        id: i.id,
        remaining: i.remaining,
        dueDate: i.dueDate,
        tenantId: group.tenantId,
      })),
      {
        toleranceExact: 0.01,
        maxCombinationSize: 4,
        maxResults: 3,
        // Petit excédent toléré (jusqu'à 10% du virement) pour proposer
        // les cas légèrement sous-couverts.
        allowExcessUpTo: Math.min(remaining * 0.1, 500),
      },
    );
  }

  // Trier les groupes : ceux ayant au moins une suggestion exacte d'abord.
  const groups = Array.from(groupsByTenant.values()).sort((a, b) => {
    const aExact = a.suggestions.some((s) => s.delta === 0);
    const bExact = b.suggestions.some((s) => s.delta === 0);
    if (aExact !== bExact) return aExact ? -1 : 1;
    return a.tenantLabel.localeCompare(b.tenantLabel, "fr");
  });

  return {
    transactionId: transaction.id,
    transactionAmount: transaction.amount,
    transactionLabel: transaction.label,
    transactionDate: transaction.transactionDate,
    alreadyAllocated,
    remaining,
    groups,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
