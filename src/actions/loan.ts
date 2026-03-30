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
  loanType: "AMORTISSABLE" | "IN_FINE" | "BULLET";
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

  if (loanType === "IN_FINE") {
    // Intérêts seuls chaque mois + capital à la dernière échéance
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
        interestPayment: monthlyInterest,
        insurancePayment: monthlyInsurance,
        totalPayment: principal + monthlyInterest + monthlyInsurance,
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
  loanType: z.enum(["AMORTISSABLE", "IN_FINE", "BULLET"]),
  amount: z.number().positive(),
  interestRate: z.number().min(0),
  insuranceRate: z.number().min(0).default(0),
  durationMonths: z.number().int().positive(),
  startDate: z.string().min(1),
  buildingId: z.string().min(1, "L'immeuble est obligatoire"),
  purchaseValue: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createLoanFromPdfSchema = z.object({
  label: z.string().min(1),
  lender: z.string().min(1),
  loanType: z.enum(["AMORTISSABLE", "IN_FINE", "BULLET"]),
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

  // Générer le tableau d'amortissement
  const amortLines = generateAmortizationTable({
    amount: d.amount,
    annualRate: d.interestRate,
    annualInsuranceRate: d.insuranceRate,
    durationMonths: d.durationMonths,
    startDate,
    loanType: d.loanType,
  });

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
      buildingId: d.buildingId ?? null,
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
      _count: { select: { amortizationLines: true } },
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
    loanType: loan.loanType as "AMORTISSABLE" | "IN_FINE" | "BULLET",
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
