"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

// ============================================================
// CALCUL D'AMORTISSEMENT
// ============================================================

interface AmortizationInput {
  amount: number;
  annualRate: number;     // taux nominal annuel en %
  annualInsuranceRate: number; // taux assurance annuel en %
  durationMonths: number;
  startDate: Date;
  loanType: "AMORTISSABLE" | "IN_FINE" | "BULLET" | "OBLIGATION" | "COMPTE_COURANT";
}

interface AmortizationLine {
  period: number;
  dueDate: Date;
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  remainingBalance: number;
}

function generateAmortizationTable(input: AmortizationInput): AmortizationLine[] {
  const { amount, annualRate, annualInsuranceRate, durationMonths, startDate, loanType } = input;
  const monthlyRate = annualRate / 100 / 12;
  const monthlyInsuranceRate = annualInsuranceRate / 100 / 12;
  const lines: AmortizationLine[] = [];

  if (loanType === "BULLET") {
    // Intérêts + capital en une seule échéance à maturité
    const years = durationMonths / 12;
    const interestPayment = Math.round(amount * annualRate / 100 * years * 100) / 100;
    const insurancePayment = Math.round(amount * annualInsuranceRate / 100 * years * 100) / 100;
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + durationMonths);
    lines.push({
      period: 1,
      dueDate,
      principalPayment: amount,
      interestPayment,
      insurancePayment,
      totalPayment: Math.round((amount + interestPayment + insurancePayment) * 100) / 100,
      remainingBalance: 0,
    });
    return lines;
  }

  if (loanType === "COMPTE_COURANT") {
    // Pas de tableau d'amortissement pour un compte courant — géré par LoanMovement
    return [];
  }

  if (loanType === "OBLIGATION" || loanType === "IN_FINE") {
    // Coupons/intérêts périodiques + capital remboursé à maturité
    const monthlyInterest = amount * monthlyRate;
    const monthlyInsurance = amount * monthlyInsuranceRate;
    for (let i = 1; i <= durationMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      const isLast = i === durationMonths;
      const principal = isLast ? amount : 0;
      lines.push({
        period: i,
        dueDate,
        principalPayment: principal,
        interestPayment: Math.round(monthlyInterest * 100) / 100,
        insurancePayment: Math.round(monthlyInsurance * 100) / 100,
        totalPayment: Math.round((principal + monthlyInterest + monthlyInsurance) * 100) / 100,
        remainingBalance: isLast ? 0 : amount,
      });
    }
    return lines;
  }

  // AMORTISSABLE — annuité constante (formule PMT)
  let remaining = amount;
  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = amount / durationMonths;
  } else {
    monthlyPayment =
      (amount * monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) /
      (Math.pow(1 + monthlyRate, durationMonths) - 1);
  }

  for (let i = 1; i <= durationMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const isLast = i === durationMonths;
    const interestPayment = remaining * monthlyRate;
    const insurancePayment = amount * monthlyInsuranceRate;

    // Dernière échéance : on solde le capital restant dû pour éviter les résidus d'arrondi
    const principalPayment = isLast ? remaining : Math.min(monthlyPayment - interestPayment, remaining);
    remaining = isLast ? 0 : Math.max(0, remaining - principalPayment);

    lines.push({
      period: i,
      dueDate,
      principalPayment: Math.round(principalPayment * 100) / 100,
      interestPayment: Math.round(interestPayment * 100) / 100,
      insurancePayment: Math.round(insurancePayment * 100) / 100,
      totalPayment: Math.round((principalPayment + interestPayment + insurancePayment) * 100) / 100,
      remainingBalance: isLast ? 0 : Math.round(remaining * 100) / 100,
    });
  }

  return lines;
}

// ============================================================
// SCHÉMAS DE VALIDATION
// ============================================================

const createLoanSchema = z.object({
  label: z.string().min(1),
  lender: z.string().min(1),
  loanType: z.enum(["AMORTISSABLE", "IN_FINE", "BULLET", "OBLIGATION", "COMPTE_COURANT"]),
  amount: z.number().positive(),
  interestRate: z.number().min(0),
  insuranceRate: z.number().min(0).default(0),
  durationMonths: z.number().int().positive(),
  startDate: z.string().min(1),
  buildingId: z.string().optional().nullable(),
  purchaseValue: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Champs spécifiques Émission obligataire
  nominalValue: z.number().positive().optional().nullable(),
  bondCount: z.number().int().positive().optional().nullable(),
  couponFrequency: z.enum(["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"]).optional().nullable(),
  issuePrice: z.number().positive().optional().nullable(),
  // Champs spécifiques Compte courant d'associé
  partnerName: z.string().optional().nullable(),
  partnerShare: z.number().min(0).max(100).optional().nullable(),
  maxAmount: z.number().positive().optional().nullable(),
  conventionDate: z.string().optional().nullable(),
});

const createLoanFromPdfSchema = z.object({
  label: z.string().min(1),
  lender: z.string().min(1),
  loanType: z.enum(["AMORTISSABLE", "IN_FINE", "BULLET", "OBLIGATION", "COMPTE_COURANT"]),
  amount: z.number().positive(),
  interestRate: z.number().min(0),
  insuranceRate: z.number().min(0).default(0),
  durationMonths: z.number().int().positive(),
  startDate: z.string().min(1),
  buildingId: z.string().min(1, "L'immeuble est obligatoire"),
  purchaseValue: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  schedule: z.array(
    z.object({
      period: z.number().int().positive(),
      dueDate: z.string().min(1),
      principal: z.number(),
      interest: z.number(),
      insurance: z.number().default(0),
      total: z.number(),
      balance: z.number(),
    })
  ).min(1, "Le tableau d'amortissement est requis"),
});

// ============================================================
// ACTIONS CRUD
// ============================================================

export async function createLoanFromPdf(societyId: string, data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié" };

  try {
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
  } catch {
    return { error: "Accès refusé" };
  }

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
    userId: session.user.id,
    action: "CREATE",
    entity: "Loan",
    entityId: loan.id,
    details: { label: d.label, amount: d.amount, lender: d.lender, source: "PDF" },
  });

  revalidatePath("/emprunts");
  return { data: loan };
}

export async function createLoan(societyId: string, data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié" };

  try {
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
  } catch {
    return { error: "Accès refusé" };
  }

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
    userId: session.user.id,
    action: "CREATE",
    entity: "Loan",
    entityId: loan.id,
    details: { label: d.label, amount: d.amount, lender: d.lender },
  });

  revalidatePath("/emprunts");
  return { data: loan };
}

export async function getLoans(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.loan.findMany({
    where: { societyId },
    include: {
      building: { select: { id: true, name: true, city: true } },
      amortizationLines: {
        where: { dueDate: { lte: new Date() } },
        orderBy: { period: "desc" },
        take: 1,
        select: { remainingBalance: true, period: true, totalPayment: true },
      },
      _count: { select: { amortizationLines: true, movements: true } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getLoanById(societyId: string, loanId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.loan.findFirst({
    where: { id: loanId, societyId },
    include: {
      building: { select: { id: true, name: true, city: true } },
      amortizationLines: { orderBy: { period: "asc" } },
      movements: { orderBy: { date: "desc" } },
    },
  });
}

export async function markAmortizationLinePaid(
  societyId: string,
  lineId: string,
  paid: boolean
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié" };

  try {
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
  } catch {
    return { error: "Accès refusé" };
  }

  const line = await prisma.loanAmortizationLine.findFirst({
    where: { id: lineId, loan: { societyId } },
  });
  if (!line) return { error: "Ligne introuvable" };

  await prisma.loanAmortizationLine.update({
    where: { id: lineId },
    data: { isPaid: paid, paidAt: paid ? new Date() : null },
  });

  revalidatePath(`/emprunts/${line.loanId}`);
  return { success: true };
}


export async function deleteLoan(societyId: string, loanId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié" };

  try {
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
  } catch {
    return { error: "Accès refusé" };
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, societyId },
    select: { id: true, label: true },
  });
  if (!loan) return { error: "Emprunt introuvable" };

  // Suppression en cascade (les lignes d'amortissement sont supprimées automatiquement via onDelete: Cascade)
  await prisma.loan.delete({ where: { id: loanId } });

  await createAuditLog({
    societyId,
    userId: session.user.id,
    action: "DELETE",
    entity: "Loan",
    entityId: loanId,
    details: { label: loan.label },
  });

  revalidatePath("/emprunts");
  return { success: true };
}

export async function regenerateAmortizationTable(societyId: string, loanId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié" };

  try {
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
  } catch {
    return { error: "Accès refusé" };
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, societyId },
    select: {
      id: true, amount: true, interestRate: true, insuranceRate: true,
      durationMonths: true, startDate: true, loanType: true, label: true,
    },
  });
  if (!loan) return { error: "Emprunt introuvable" };

  // Récupérer les lignes payées pour préserver leur statut
  const paidLinesByPeriod = new Map<number, { isPaid: boolean; paidAt: Date | null }>();
  const existingLines = await prisma.loanAmortizationLine.findMany({
    where: { loanId },
    select: { period: true, isPaid: true, paidAt: true },
  });
  for (const line of existingLines) {
    if (line.isPaid) {
      paidLinesByPeriod.set(line.period, { isPaid: true, paidAt: line.paidAt });
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
      };
    }),
  });

  await createAuditLog({
    societyId,
    userId: session.user.id,
    action: "UPDATE",
    entity: "Loan",
    entityId: loanId,
    details: { action: "regenerate_amortization", linesCount: newLines.length },
  });

  revalidatePath(`/emprunts/${loanId}`);
  return { success: true, data: { linesCount: newLines.length } };
}

// ============================================================
// BUDGET / PRÉVISIONNEL
// ============================================================

const budgetLineSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional().nullable(),
  accountId: z.string().cuid(),
  budgetAmount: z.number(),
  label: z.string().optional().nullable(),
});

export async function upsertBudgetLine(societyId: string, data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié" };

  try {
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
  } catch {
    return { error: "Accès refusé" };
  }

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
}

// ============================================================
// MOUVEMENTS COMPTE COURANT D'ASSOCIÉ
// ============================================================

const addMovementSchema = z.object({
  loanId: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(["APPORT", "RETRAIT", "INTERETS"]),
  amount: z.number().positive("Le montant doit être positif"),
  description: z.string().optional().nullable(),
});

export async function addLoanMovement(societyId: string, data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié" };

  try {
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
  } catch {
    return { error: "Accès refusé" };
  }

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
    userId: session.user.id,
    action: "CREATE",
    entity: "LoanMovement",
    entityId: movement.id,
    details: { loanId: d.loanId, type: d.type, amount: d.amount, newBalance },
  });

  revalidatePath(`/emprunts/${d.loanId}`);
  return { data: movement };
}

export async function getLoanMovements(societyId: string, loanId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.loanMovement.findMany({
    where: { loanId, loan: { societyId } },
    orderBy: { date: "desc" },
  });
}

export async function deleteLoanMovement(societyId: string, movementId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Non authentifié" };

  try {
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
  } catch {
    return { error: "Accès refusé" };
  }

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
    userId: session.user.id,
    action: "DELETE",
    entity: "LoanMovement",
    entityId: movementId,
    details: { loanId: movement.loanId, type: movement.type, amount: movement.amount },
  });

  revalidatePath(`/emprunts/${movement.loanId}`);
  return { success: true };
}

export async function getBudgetLines(societyId: string, year: number) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.budgetLine.findMany({
    where: { societyId, year },
    include: {
      account: { select: { id: true, code: true, label: true, type: true } },
    },
    orderBy: [{ account: { code: "asc" } }, { month: "asc" }],
  });
}
