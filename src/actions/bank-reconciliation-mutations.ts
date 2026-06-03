"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { bankReconciliationSchema, type BankReconciliationInput } from "@/validations/bank";
import { resolveOpenFiscalYearIdForDate } from "@/lib/accounting-period";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { generateAndSendQuittance } from "@/actions/invoice";
import {
  buildBankAccountFallback,
  buildSupplierAccountFallback,
  createBankJournalEntryForTransaction,
  createReconciliationRecord,
  findLoanComponentMatch,
  isLoanLineFullyPaidAfterMatch,
  roundCents,
  tenantDisplayName,
  upsertAccountingAccount,
} from "@/actions/bank-reconciliation-shared";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

// ─── Rapprochement automatique ────────────────────────────────────────────────

export async function autoReconcile(
  societyId: string,
  bankAccountId: string
): Promise<ActionResult<{ matched: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, societyId },
    });
    if (!account) return { success: false, error: "Compte introuvable" };

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
        await createReconciliationRecord(tx.id, exactMatch.id, exactMatch.amount, true, undefined, context.userId, {
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
        await createReconciliationRecord(tx.id, approxMatch.id, approxMatch.amount, true, undefined, context.userId, {
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
        await createReconciliationRecord(tx.id, netMatch.id, netMatch.amount, true, undefined, context.userId, {
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
          amount: payment.amount,
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
      include: {
        transaction: {
          include: {
            journalEntry: true,
            reconciliations: { select: { id: true } },
          },
        },
      },
    });
    if (!reconciliation) return { success: false, error: "Rapprochement introuvable" };

    if (
      reconciliation.transaction.journalEntry &&
      (reconciliation.transaction.journalEntry.isValidated || reconciliation.transaction.journalEntry.status !== "BROUILLON")
    ) {
      return { success: false, error: "Impossible d'annuler un rapprochement dont l'écriture comptable est validée" };
    }

    // S'il reste d'autres réconciliations sur la transaction (cas ventilé),
    // on ne supprime que ce lien et on garde la transaction rapprochée.
    const hasOtherReconciliations = reconciliation.transaction.reconciliations.length > 1;

    await prisma.$transaction(async (tx) => {
      await tx.bankReconciliation.delete({ where: { id: reconciliationId } });
      await tx.payment.update({
        where: { id: reconciliation.paymentId },
        data: { isReconciled: false },
      });

      if (!hasOtherReconciliations) {
        await tx.bankTransaction.update({
          where: { id: reconciliation.transactionId },
          data: { isReconciled: false, journalEntryId: null },
        });
        if (reconciliation.transaction.journalEntryId) {
          await tx.journalEntry.delete({ where: { id: reconciliation.transaction.journalEntryId } });
        }
        // Si la suppression annule un trop-perçu, ré-ouvrir l'éventuel ajustement
        await tx.tenantBalanceAdjustment.deleteMany({
          where: {
            reconciledBankTransactionId: reconciliation.transactionId,
            source: "BANK_RECONCILIATION",
          },
        });
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

// ─── Rapprochement avec une reprise de solde ─────────────────────────────────

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
        include: { reconciliations: { select: { amount: true } } },
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
    const targetAmount = invoice.isThirdPartyManaged && invoice.expectedNetAmount
      ? invoice.expectedNetAmount
      : invoice.totalTTC;
    const invoiceUnpaid = Math.max(0, targetAmount - paidSoFar);
    if (invoiceUnpaid <= 0.01) {
      return { success: false, error: "Cette facture est déjà soldée" };
    }
    // Reste à allouer sur la transaction (peut être < transaction.amount si déjà ventilée).
    const alreadyAllocatedOnTx = (transaction.reconciliations ?? []).reduce((s, r) => s + r.amount, 0);
    const txRemaining = round2(transaction.amount - alreadyAllocatedOnTx);
    if (txRemaining <= 0.01) {
      return { success: false, error: "Cette transaction est déjà entièrement ventilée" };
    }
    // On ne surpaye jamais la facture, on n'alloue jamais plus que ce qu'il reste sur la tx.
    const allocAmount = round2(Math.min(txRemaining, invoiceUnpaid));
    const newInvoiceTotalPaid = paidSoFar + allocAmount;
    const newStatus = newInvoiceTotalPaid >= targetAmount - 0.01 ? "PAYE" : "PARTIELLEMENT_PAYE";
    const fullyConsumesTx = allocAmount >= txRemaining - 0.01;

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: allocAmount,
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
          amount: allocAmount,
          isValidated: true,
          validatedAt: new Date(),
          validatedBy: context.userId,
        },
      });
      // Journal BQUE : créé uniquement quand la tx est totalement ventilée
      // (sinon on aurait une écriture partielle puis une autre — pas propre).
      if (fullyConsumesTx) {
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
      }
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

// ─── Ventilation d'un virement sur plusieurs factures ─────────────────────────

export interface AllocationInput {
  invoiceId: string;
  amount: number;
}

/**
 * Ventile un virement bancaire sur plusieurs factures du même locataire.
 *
 * Couvre :
 *   - 1 virement → 1 facture (somme = montant)
 *   - 1 virement → N factures (somme = montant)
 *   - Trop-perçu (somme < montant transaction) → avoir créé via
 *     `TenantBalanceAdjustment` négatif sur le locataire commun
 *   - Paiement partiel (somme < montant transaction sans excédent à crédit)
 *     → la transaction reste partiellement rapprochée
 *
 * Règles :
 *   - Toutes les factures doivent appartenir à la même société et au même
 *     locataire (pour pouvoir attribuer l'éventuel excédent).
 *   - La somme allouée ne peut pas dépasser le montant du virement.
 *   - Une seule allocation par invoiceId (pas de double imputation).
 */
export async function reconcileTransactionWithAllocations(
  societyId: string,
  transactionId: string,
  allocations: AllocationInput[],
  options?: { creditExcessToTenant?: boolean }
): Promise<ActionResult<{ paymentIds: string[]; balanceAdjustmentId: string | null }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    if (!allocations.length) {
      return { success: false, error: "Aucune facture sélectionnée pour la ventilation" };
    }
    const dedupSet = new Set(allocations.map((a) => a.invoiceId));
    if (dedupSet.size !== allocations.length) {
      return { success: false, error: "Une même facture ne peut pas apparaître plusieurs fois dans la ventilation" };
    }
    for (const a of allocations) {
      if (!Number.isFinite(a.amount) || a.amount <= 0) {
        return { success: false, error: "Tous les montants alloués doivent être strictement positifs" };
      }
    }

    const transaction = await prisma.bankTransaction.findFirst({
      where: { id: transactionId, bankAccount: { societyId } },
      include: {
        reconciliations: { select: { amount: true } },
      },
    });
    if (!transaction) return { success: false, error: "Transaction introuvable" };
    if (transaction.amount <= 0) {
      return { success: false, error: "Une ventilation locataire nécessite une transaction créditrice (encaissement)" };
    }

    const alreadyAllocated = transaction.reconciliations.reduce((s, r) => s + r.amount, 0);
    const totalAllocated = allocations.reduce((s, a) => s + a.amount, 0);
    if (alreadyAllocated + totalAllocated > transaction.amount + 0.01) {
      return {
        success: false,
        error: `Ventilation totale (${(alreadyAllocated + totalAllocated).toFixed(2)} €) dépasse le montant du virement (${transaction.amount.toFixed(2)} €)`,
      };
    }

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: allocations.map((a) => a.invoiceId) }, societyId },
      select: {
        id: true,
        tenantId: true,
        leaseId: true,
        totalTTC: true,
        invoiceType: true,
        isThirdPartyManaged: true,
        expectedNetAmount: true,
      },
    });
    if (invoices.length !== allocations.length) {
      return { success: false, error: "Une ou plusieurs factures sont introuvables pour cette société" };
    }

    const uniqueTenants = new Set(invoices.map((i) => i.tenantId));
    if (uniqueTenants.size !== 1) {
      return { success: false, error: "Les factures ventilées doivent appartenir au même locataire" };
    }
    const tenantId = invoices[0].tenantId;
    const leaseId = invoices.find((i) => i.leaseId)?.leaseId ?? null;

    const excess = round2(transaction.amount - alreadyAllocated - totalAllocated);
    const creditExcess = options?.creditExcessToTenant !== false; // défaut: true
    const willCreditExcess = excess > 0.01 && creditExcess;
    const willFullyReconcile = willCreditExcess || Math.abs(excess) <= 0.01;

    const created = await prisma.$transaction(async (tx) => {
      const paymentIds: string[] = [];

      for (const allocation of allocations) {
        const invoice = invoices.find((i) => i.id === allocation.invoiceId)!;
        const payment = await tx.payment.create({
          data: {
            invoiceId: allocation.invoiceId,
            amount: allocation.amount,
            paidAt: transaction.transactionDate,
            method: "virement",
            reference: transaction.reference ?? undefined,
            isReconciled: true,
          },
        });
        paymentIds.push(payment.id);

        await tx.bankReconciliation.create({
          data: {
            transactionId,
            paymentId: payment.id,
            amount: allocation.amount,
            isValidated: true,
            validatedAt: new Date(),
            validatedBy: context.userId,
          },
        });

        const paidAgg = await tx.payment.aggregate({
          where: { invoiceId: allocation.invoiceId },
          _sum: { amount: true },
        });
        const paidSoFar = paidAgg._sum.amount ?? 0;
        const target = invoice.isThirdPartyManaged && invoice.expectedNetAmount
          ? invoice.expectedNetAmount
          : invoice.totalTTC;
        const newStatus = paidSoFar >= target - 0.01 ? "PAYE" : "PARTIELLEMENT_PAYE";
        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: { status: newStatus },
        });
      }

      let balanceAdjustmentId: string | null = null;
      if (willCreditExcess) {
        const adj = await tx.tenantBalanceAdjustment.create({
          data: {
            societyId,
            tenantId,
            leaseId,
            label: "Avoir — trop-perçu sur virement",
            amount: -excess,
            dueDate: transaction.transactionDate,
            notes: `Virement de ${transaction.amount.toFixed(2)} € ventilé sur ${allocations.length} facture(s). Excédent crédité.`,
            reference: transaction.reference ?? null,
            source: "BANK_RECONCILIATION",
            reconciledBankTransactionId: transactionId,
          },
        });
        balanceAdjustmentId = adj.id;
      }

      if (willFullyReconcile) {
        await tx.bankTransaction.update({
          where: { id: transactionId },
          data: { isReconciled: true },
        });
      }

      return { paymentIds, balanceAdjustmentId };
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "BankReconciliation",
      entityId: transactionId,
      details: {
        action: "reconcile_transaction_allocations",
        transactionId,
        allocations: allocations.length,
        totalAllocated: round2(totalAllocated),
        excess: willCreditExcess ? excess : 0,
        tenantId,
        invoiceIds: allocations.map((a) => a.invoiceId),
      },
    });

    revalidatePath("/banque");
    revalidatePath(`/banque/${transaction.bankAccountId}/rapprochement`);
    revalidatePath(`/banque/${transaction.bankAccountId}`);
    revalidatePath("/comptabilite");
    revalidatePath("/facturation");
    revalidatePath(`/locataires/${tenantId}`);

    return { success: true, data: created };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[reconcileTransactionWithAllocations]", error);
    return { success: false, error: "Erreur lors de la ventilation du virement" };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
