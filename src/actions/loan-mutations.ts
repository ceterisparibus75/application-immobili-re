"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  createLoanSchema,
  createLoanFromPdfSchema,
  updateLoanSchema,
  updateAmortizationLineSchema,
  budgetLineSchema,
  addMovementSchema,
  generateAmortizationTable,
  type AmortizationInput,
} from "@/actions/loan-shared";

export async function createLoanFromPdf(
  societyId: string,
  data: unknown,
  pdfDoc?: { fileName: string; fileUrl: string; storagePath: string; fileSize: number }
) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createLoanFromPdfSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const d = parsed.data;
    const startDate = new Date(d.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + d.durationMonths);

    // Convertir le tableau extrait du PDF en lignes d'amortissement
    const amortLines = d.schedule.map((line) => ({
      period: line.period,
      dueDate: new Date(line.dueDate),
      principalPayment: line.principal,
      interestPayment: line.interest,
      insurancePayment: line.insurance,
      totalPayment: line.total,
      remainingBalance: line.balance,
    }));

    const loan = await prisma.loan.create({
      data: {
        societyId,
        label: d.label,
        lender: d.lender,
        loanType: d.loanType,
        amount: d.amount,
        interestRate: d.interestRate,
        insuranceRate: d.insuranceRate,
        durationMonths: d.durationMonths,
        startDate,
        endDate,
        buildingId: d.buildingId,
        purchaseValue: d.purchaseValue ?? null,
        notes: d.notes ?? null,
        amortizationLines: {
          create: amortLines,
        },
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Loan",
      entityId: loan.id,
      details: { label: d.label, amount: d.amount, lender: d.lender, source: "PDF" },
    });

    if (pdfDoc) {
      await prisma.document.create({
        data: {
          societyId,
          fileName: pdfDoc.fileName,
          fileUrl: pdfDoc.fileUrl,
          storagePath: pdfDoc.storagePath,
          fileSize: pdfDoc.fileSize,
          mimeType: "application/pdf",
          category: "financier",
          description: "Tableau d'amortissement — " + d.label,
          buildingId: d.buildingId ?? null,
        },
      });
    }

    revalidatePath("/emprunts");
    return { data: loan };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}

export async function createLoan(societyId: string, data: unknown) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createLoanSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const d = parsed.data;
    const startDate = new Date(d.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + d.durationMonths);

  // Générer le tableau d'amortissement (vide pour COMPTE_COURANT)
  const amortLines = generateAmortizationTable({
    amount: d.amount,
    annualRate: d.interestRate,
    annualInsuranceRate: d.insuranceRate,
    durationMonths: d.durationMonths,
    startDate,
    loanType: d.loanType,
  });

  // Construire les données spécifiques selon le type
  const loanData: Record<string, unknown> = {
    societyId,
    label: d.label,
    lender: d.lender,
    loanType: d.loanType,
    amount: d.amount,
    interestRate: d.interestRate,
    insuranceRate: d.insuranceRate,
    durationMonths: d.durationMonths,
    startDate,
    endDate,
    buildingId: d.buildingId ?? null,
    purchaseValue: d.purchaseValue ?? null,
    notes: d.notes ?? null,
  };

  // Champs spécifiques Obligation
  if (d.loanType === "OBLIGATION") {
    loanData.nominalValue = d.nominalValue ?? null;
    loanData.bondCount = d.bondCount ?? null;
    loanData.couponFrequency = d.couponFrequency ?? null;
    loanData.issuePrice = d.issuePrice ?? null;
  }

  // Champs spécifiques Compte courant
  if (d.loanType === "COMPTE_COURANT") {
    loanData.partnerName = d.partnerName ?? null;
    loanData.partnerShare = d.partnerShare ?? null;
    loanData.maxAmount = d.maxAmount ?? null;
    loanData.conventionDate = d.conventionDate ? new Date(d.conventionDate) : null;
    loanData.currentBalance = d.amount; // Solde initial = montant apporté
  }

  // Ajouter les lignes d'amortissement seulement si elles existent
  if (amortLines.length > 0) {
    (loanData as Record<string, unknown>).amortizationLines = { create: amortLines };
  }

  // Créer le mouvement initial pour un compte courant
  if (d.loanType === "COMPTE_COURANT") {
    (loanData as Record<string, unknown>).movements = {
      create: [{
        date: startDate,
        type: "APPORT" as const,
        amount: d.amount,
        balanceAfter: d.amount,
        description: "Apport initial",
      }],
    };
  }

    const loan = await prisma.loan.create({
      data: loanData as Parameters<typeof prisma.loan.create>[0]["data"],
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Loan",
      entityId: loan.id,
      details: { label: d.label, amount: d.amount, lender: d.lender },
    });

    revalidatePath("/emprunts");
    return { data: loan };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}


export async function markAmortizationLinePaid(
  societyId: string,
  lineId: string,
  paid: boolean
) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const line = await prisma.loanAmortizationLine.findFirst({
      where: { id: lineId, loan: { societyId } },
    });
    if (!line) return { error: "Ligne introuvable" };

    const paidAt = new Date();
    await prisma.loanAmortizationLine.update({
      where: { id: lineId },
      data: paid
        ? {
            isPaid: true,
            paidAt,
            principalPaidAt: line.principalPaidAt ?? (line.principalPayment > 0.01 ? paidAt : null),
            interestPaidAt: line.interestPaidAt ?? (line.interestPayment > 0.01 ? paidAt : null),
            insurancePaidAt: line.insurancePaidAt ?? (line.insurancePayment > 0.01 ? paidAt : null),
          }
        : {
            isPaid: false,
            paidAt: null,
            principalPaidAt: line.principalBankTransactionId ? line.principalPaidAt : null,
            interestPaidAt: line.interestBankTransactionId ? line.interestPaidAt : null,
            insurancePaidAt: line.insuranceBankTransactionId ? line.insurancePaidAt : null,
          },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LoanAmortizationLine",
      entityId: lineId,
      details: { loanId: line.loanId, isPaid: paid },
    });

    revalidatePath(`/emprunts/${line.loanId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}


export async function updateAmortizationLine(
  societyId: string,
  lineId: string,
  data: unknown
) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateAmortizationLineSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const line = await prisma.loanAmortizationLine.findFirst({
      where: { id: lineId, loan: { societyId } },
    });
    if (!line) return { error: "Ligne introuvable" };

    await prisma.loanAmortizationLine.update({
      where: { id: lineId },
      data: parsed.data,
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LoanAmortizationLine",
      entityId: lineId,
      details: { loanId: line.loanId, ...parsed.data },
    });

    revalidatePath(`/emprunts/${line.loanId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}


// ============================================================
// UPDATE LOAN
// ============================================================


export async function updateLoan(societyId: string, loanId: string, data: unknown) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateLoanSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const existing = await prisma.loan.findFirst({
      where: { id: loanId, societyId },
      select: {
        id: true, amount: true, interestRate: true, insuranceRate: true,
        durationMonths: true, startDate: true, loanType: true, label: true,
      },
    });
    if (!existing) return { error: "Emprunt introuvable" };

    const d = parsed.data;
    const startDate = new Date(d.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + d.durationMonths);

    const isCC = existing.loanType === "COMPTE_COURANT";
    const needsRegen = !isCC && (
      Math.abs(d.amount - existing.amount) > 0.01 ||
      Math.abs(d.interestRate - existing.interestRate) > 0.0001 ||
      Math.abs(d.insuranceRate - existing.insuranceRate) > 0.0001 ||
      d.durationMonths !== existing.durationMonths ||
      startDate.getTime() !== new Date(existing.startDate).getTime()
    );

    await prisma.loan.update({
      where: { id: loanId },
      data: {
        label: d.label,
        lender: d.lender,
        amount: d.amount,
        interestRate: d.interestRate,
        insuranceRate: d.insuranceRate,
        durationMonths: d.durationMonths,
        startDate,
        endDate,
        purchaseValue: d.purchaseValue ?? null,
        notes: d.notes ?? null,
        partnerName: d.partnerName ?? null,
        partnerShare: d.partnerShare ?? null,
        maxAmount: d.maxAmount ?? null,
        conventionDate: d.conventionDate ? new Date(d.conventionDate) : null,
        nominalValue: d.nominalValue ?? null,
        bondCount: d.bondCount ?? null,
        couponFrequency: d.couponFrequency ?? null,
        issuePrice: d.issuePrice ?? null,
      },
    });

    let linesCount: number | null = null;

    if (needsRegen) {
      const existingLines = await prisma.loanAmortizationLine.findMany({
        where: { loanId },
        select: {
          period: true, isPaid: true, paidAt: true,
          principalPaidAt: true, interestPaidAt: true, insurancePaidAt: true,
          principalBankTransactionId: true, interestBankTransactionId: true, insuranceBankTransactionId: true,
        },
      });

      const paidMap = new Map<number, typeof existingLines[number]>();
      for (const line of existingLines) {
        if (line.isPaid || line.principalPaidAt || line.interestPaidAt || line.insurancePaidAt) {
          paidMap.set(line.period, line);
        }
      }

      await prisma.loanAmortizationLine.deleteMany({ where: { loanId } });

      const newLines = generateAmortizationTable({
        amount: d.amount,
        annualRate: d.interestRate,
        annualInsuranceRate: d.insuranceRate,
        durationMonths: d.durationMonths,
        startDate,
        loanType: existing.loanType as AmortizationInput["loanType"],
      });

      await prisma.loanAmortizationLine.createMany({
        data: newLines.map((line) => {
          const paid = paidMap.get(line.period);
          return {
            loanId,
            period: line.period,
            dueDate: line.dueDate,
            principalPayment: line.principalPayment,
            interestPayment: line.interestPayment,
            insurancePayment: line.insurancePayment,
            totalPayment: line.totalPayment,
            remainingBalance: line.remainingBalance,
            isPaid: paid?.isPaid ?? false,
            paidAt: paid?.paidAt ?? null,
            principalPaidAt: paid?.principalPaidAt ?? null,
            interestPaidAt: paid?.interestPaidAt ?? null,
            insurancePaidAt: paid?.insurancePaidAt ?? null,
            principalBankTransactionId: paid?.principalBankTransactionId ?? null,
            interestBankTransactionId: paid?.interestBankTransactionId ?? null,
            insuranceBankTransactionId: paid?.insuranceBankTransactionId ?? null,
          };
        }),
      });

      linesCount = newLines.length;
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Loan",
      entityId: loanId,
      details: { label: d.label, interestRate: d.interestRate, regenerated: needsRegen, linesCount },
    });

    revalidatePath(`/emprunts/${loanId}`);
    revalidatePath("/emprunts");
    return { success: true, data: { regenerated: needsRegen, linesCount } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    console.error("[updateLoan]", error);
    return { error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteLoan(societyId: string, loanId: string) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, societyId },
      select: { id: true, label: true },
    });
    if (!loan) return { error: "Emprunt introuvable" };

    // Suppression en cascade (les lignes d'amortissement sont supprimées automatiquement via onDelete: Cascade)
    await prisma.loan.delete({ where: { id: loanId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Loan",
      entityId: loanId,
      details: { label: loan.label },
    });

    revalidatePath("/emprunts");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}

export async function regenerateAmortizationTable(societyId: string, loanId: string) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, societyId },
    select: {
      id: true, amount: true, interestRate: true, insuranceRate: true,
      durationMonths: true, startDate: true, loanType: true, label: true,
    },
  });
  if (!loan) return { error: "Emprunt introuvable" };

  // Récupérer les lignes payées pour préserver leur statut
  const paidLinesByPeriod = new Map<
    number,
    {
      isPaid: boolean;
      paidAt: Date | null;
      principalPaidAt: Date | null;
      interestPaidAt: Date | null;
      insurancePaidAt: Date | null;
      principalBankTransactionId: string | null;
      interestBankTransactionId: string | null;
      insuranceBankTransactionId: string | null;
    }
  >();
  const existingLines = await prisma.loanAmortizationLine.findMany({
    where: { loanId },
    select: {
      period: true,
      isPaid: true,
      paidAt: true,
      principalPaidAt: true,
      interestPaidAt: true,
      insurancePaidAt: true,
      principalBankTransactionId: true,
      interestBankTransactionId: true,
      insuranceBankTransactionId: true,
    },
  });
  for (const line of existingLines) {
    if (line.isPaid || line.principalPaidAt || line.interestPaidAt || line.insurancePaidAt) {
      paidLinesByPeriod.set(line.period, {
        isPaid: line.isPaid,
        paidAt: line.paidAt,
        principalPaidAt: line.principalPaidAt,
        interestPaidAt: line.interestPaidAt,
        insurancePaidAt: line.insurancePaidAt,
        principalBankTransactionId: line.principalBankTransactionId,
        interestBankTransactionId: line.interestBankTransactionId,
        insuranceBankTransactionId: line.insuranceBankTransactionId,
      });
    }
  }

  // Supprimer les anciennes lignes
  await prisma.loanAmortizationLine.deleteMany({ where: { loanId } });

  // Régénérer avec la formule corrigée
  const newLines = generateAmortizationTable({
    amount: loan.amount,
    annualRate: loan.interestRate,
    annualInsuranceRate: loan.insuranceRate,
    durationMonths: loan.durationMonths,
    startDate: new Date(loan.startDate),
    loanType: loan.loanType as AmortizationInput["loanType"],
  });

  // Créer les nouvelles lignes en restaurant le statut payé
  await prisma.loanAmortizationLine.createMany({
    data: newLines.map((line) => {
      const paid = paidLinesByPeriod.get(line.period);
      return {
        loanId,
        period: line.period,
        dueDate: line.dueDate,
        principalPayment: line.principalPayment,
        interestPayment: line.interestPayment,
        insurancePayment: line.insurancePayment,
        totalPayment: line.totalPayment,
        remainingBalance: line.remainingBalance,
        isPaid: paid?.isPaid ?? false,
        paidAt: paid?.paidAt ?? null,
        principalPaidAt: paid?.principalPaidAt ?? null,
        interestPaidAt: paid?.interestPaidAt ?? null,
        insurancePaidAt: paid?.insurancePaidAt ?? null,
        principalBankTransactionId: paid?.principalBankTransactionId ?? null,
        interestBankTransactionId: paid?.interestBankTransactionId ?? null,
        insuranceBankTransactionId: paid?.insuranceBankTransactionId ?? null,
      };
    }),
  });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Loan",
      entityId: loanId,
      details: { action: "regenerate_amortization", linesCount: newLines.length },
    });

    revalidatePath(`/emprunts/${loanId}`);
    return { success: true, data: { linesCount: newLines.length } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}

// ============================================================
// BUDGET / PRÉVISIONNEL
// ============================================================


export async function upsertBudgetLine(societyId: string, data: unknown) {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = budgetLineSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

  const d = parsed.data;
  const month = d.month ?? null;

  // Prisma ne supporte pas null dans les contraintes uniques composites via upsert
  const existing = await prisma.budgetLine.findFirst({
    where: { societyId, year: d.year, month, accountId: d.accountId },
  });

  let result;
  if (existing) {
    result = await prisma.budgetLine.update({
      where: { id: existing.id },
      data: { budgetAmount: d.budgetAmount, label: d.label ?? null },
    });
  } else {
    result = await prisma.budgetLine.create({
      data: {
        societyId,
        year: d.year,
        month,
        accountId: d.accountId,
        budgetAmount: d.budgetAmount,
        label: d.label ?? null,
      },
    });
  }

    revalidatePath("/comptabilite/previsionnel");
    return { data: result };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}

// ============================================================
// MOUVEMENTS COMPTE COURANT D'ASSOCIÉ
// ============================================================


export async function addLoanMovement(societyId: string, data: unknown) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = addMovementSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

  const d = parsed.data;

  // Vérifier que l'emprunt est un compte courant
  const loan = await prisma.loan.findFirst({
    where: { id: d.loanId, societyId, loanType: "COMPTE_COURANT" },
    select: { id: true, currentBalance: true, maxAmount: true, label: true },
  });
  if (!loan) return { error: "Compte courant introuvable" };

  const currentBalance = loan.currentBalance ?? 0;
  let newBalance: number;

  if (d.type === "APPORT") {
    newBalance = currentBalance + d.amount;
    // Vérifier le plafond si défini
    if (loan.maxAmount && newBalance > loan.maxAmount) {
      return { error: `Le plafond de ${loan.maxAmount.toLocaleString("fr-FR")} € serait dépassé` };
    }
  } else if (d.type === "RETRAIT") {
    newBalance = currentBalance - d.amount;
    if (newBalance < 0) {
      return { error: "Solde insuffisant pour ce retrait" };
    }
  } else {
    // INTERETS — les intérêts augmentent le solde (dus à l'associé)
    newBalance = currentBalance + d.amount;
  }

  newBalance = Math.round(newBalance * 100) / 100;

  const movement = await prisma.loanMovement.create({
    data: {
      loanId: d.loanId,
      date: new Date(d.date),
      type: d.type,
      amount: d.amount,
      balanceAfter: newBalance,
      description: d.description ?? null,
    },
  });

  // Mettre à jour le solde courant
  await prisma.loan.update({
    where: { id: d.loanId },
    data: { currentBalance: newBalance },
  });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "LoanMovement",
      entityId: movement.id,
      details: { loanId: d.loanId, type: d.type, amount: d.amount, newBalance },
    });

    revalidatePath(`/emprunts/${d.loanId}`);
    return { data: movement };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}


export async function deleteLoanMovement(societyId: string, movementId: string) {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

  const movement = await prisma.loanMovement.findFirst({
    where: { id: movementId, loan: { societyId } },
    include: { loan: { select: { id: true, loanType: true } } },
  });
  if (!movement) return { error: "Mouvement introuvable" };

  // Recalculer le solde en rejouant tous les mouvements sauf celui supprimé
  const allMovements = await prisma.loanMovement.findMany({
    where: { loanId: movement.loanId, id: { not: movementId } },
    orderBy: { date: "asc" },
  });

  let balance = 0;
  for (const m of allMovements) {
    if (m.type === "RETRAIT") {
      balance -= m.amount;
    } else {
      balance += m.amount;
    }
    balance = Math.round(balance * 100) / 100;
    // Mettre à jour le balanceAfter de chaque mouvement restant
    await prisma.loanMovement.update({
      where: { id: m.id },
      data: { balanceAfter: balance },
    });
  }

  // Supprimer le mouvement
  await prisma.loanMovement.delete({ where: { id: movementId } });

  // Mettre à jour le solde du compte courant
  await prisma.loan.update({
    where: { id: movement.loanId },
    data: { currentBalance: balance },
  });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "LoanMovement",
      entityId: movementId,
      details: { loanId: movement.loanId, type: movement.type, amount: movement.amount },
    });

    revalidatePath(`/emprunts/${movement.loanId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { error: "Accès refusé" };
    throw error;
  }
}

