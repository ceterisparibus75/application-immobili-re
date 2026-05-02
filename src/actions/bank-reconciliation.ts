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
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

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
          label: true,
          transactionDate: true,
          amount: true,
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
            select: { isThirdPartyManaged: true, expectedNetAmount: true },
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
        await createReconciliationRecord(tx.id, exactMatch.id, true);
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
        await createReconciliationRecord(tx.id, approxMatch.id, true);
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
        await createReconciliationRecord(tx.id, netMatch.id, true);
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
    });
    if (!payment) return { success: false, error: "Paiement introuvable" };
    if (Math.abs(transaction.amount - payment.amount) > 0.01) {
      return { success: false, error: "Le montant de la transaction ne correspond pas au paiement sélectionné" };
    }

    await createReconciliationRecord(
      parsed.data.transactionId,
      parsed.data.paymentId,
      true,
      parsed.data.notes,
      context.userId
    );

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "BankReconciliation",
      entityId: parsed.data.transactionId,
      details: { transactionId: parsed.data.transactionId, paymentId: parsed.data.paymentId },
    });

    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath(`/banque/${transaction.bankAccountId}`);
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

    // Chercher ou créer les comptes comptables
    const [compte512, compte411, compte658, compte622] = await Promise.all([
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
      prisma.accountingAccount.upsert({
        where: { societyId_code: { societyId, code: "622" } },
        update: {},
        create: { societyId, code: "622", label: "Remunerations d'intermediaires et honoraires", type: "6" },
      }),
    ]);

    const amount = Math.abs(transaction.amount);
    const isIncome = transaction.amount > 0;
    const hasInvoice = transaction.reconciliations.length > 0;

    // Detecter si la transaction concerne une facture en gestion tiers
    const thirdPartyInvoice = transaction.reconciliations.find(
      (r) => r.payment?.invoice?.isThirdPartyManaged && r.payment?.invoice?.managementFeeTTC
    )?.payment?.invoice;

    // Compte de contrepartie selon la nature de la transaction
    const contraAccount = hasInvoice ? compte411 : compte658;

    // Construire les lignes d'ecriture
    let journalLines;
    if (isIncome && thirdPartyInvoice && thirdPartyInvoice.managementFeeTTC) {
      // Gestion tiers : ecriture a 3 lignes
      // Debit 512 (Banque) : montant net recu
      // Debit 622 (Honoraires) : honoraires TTC
      // Credit 411 (Client) : montant brut TTC
      const feeAmount = thirdPartyInvoice.managementFeeTTC;
      const grossAmount = amount + feeAmount;
      journalLines = [
        { accountId: compte512.id, debit: amount, credit: 0, label: "Virement agence (net)" },
        { accountId: compte622.id, debit: Math.round(feeAmount * 100) / 100, credit: 0, label: "Honoraires de gestion" },
        { accountId: compte411.id, debit: 0, credit: Math.round(grossAmount * 100) / 100, label: "Loyer brut TTC" },
      ];
    } else if (isIncome) {
      // Entree d'argent standard : Debit 512 Banque / Credit 411 Clients
      journalLines = [
        { accountId: compte512.id, debit: amount, credit: 0, label: transaction.label },
        { accountId: contraAccount.id, debit: 0, credit: amount, label: transaction.label },
      ];
    } else {
      // Sortie d'argent : Debit 658 Charges / Credit 512 Banque
      journalLines = [
        { accountId: contraAccount.id, debit: amount, credit: 0, label: transaction.label },
        { accountId: compte512.id, debit: 0, credit: amount, label: transaction.label },
      ];
    }

    const fiscalYearId = await resolveOpenFiscalYearIdForDate(prisma, societyId, transaction.transactionDate);
    const entry = await prisma.journalEntry.create({
      data: {
        societyId,
        fiscalYearId,
        journalType: "BQUE",
        entryDate: transaction.transactionDate,
        label: transaction.label,
        reference: transaction.reference ?? undefined,
        lines: { create: journalLines },
      },
    });
    await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: { journalEntryId: entry.id },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: entry.id,
      details: { transactionId, amount, type: isIncome ? "recette" : "depense" },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { id: entry.id } };
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
      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: { isReconciled: true },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "BankReconciliation",
      entityId: transactionId,
      details: { invoiceId, action: "reconcile_invoice" },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
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

    await prisma.$transaction([
      prisma.bankTransaction.update({ where: { id: transactionId }, data: { isReconciled: true } }),
      prisma.loanAmortizationLine.update({
        where: { id: loanLineId },
        data: { isPaid: true, paidAt: transaction.transactionDate },
      }),
    ]);

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LoanAmortizationLine",
      entityId: loanLineId,
      details: { transactionId, action: "reconcile_loan_payment" },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath("/emprunts");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reconcileWithLoanLine]", error);
    return { success: false, error: "Erreur lors du rapprochement" };
  }
}
