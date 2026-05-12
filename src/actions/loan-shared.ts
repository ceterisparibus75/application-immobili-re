// Types, schémas Zod et calcul d'amortissement — pas de "use server".

import { z } from "zod";

export interface AmortizationInput {
  amount: number;
  annualRate: number;     // taux nominal annuel en %
  annualInsuranceRate: number; // taux assurance annuel en %
  durationMonths: number;
  startDate: Date;
  loanType: "AMORTISSABLE" | "IN_FINE" | "BULLET" | "OBLIGATION" | "COMPTE_COURANT";
}

export interface AmortizationLine {
  period: number;
  dueDate: Date;
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  remainingBalance: number;
}

export function generateAmortizationTable(input: AmortizationInput): AmortizationLine[] {
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

export const updateAmortizationLineSchema = z.object({
  principalPayment: z.number().min(0),
  interestPayment: z.number().min(0),
  insurancePayment: z.number().min(0),
  totalPayment: z.number().min(0),
  remainingBalance: z.number().min(0),
});

export const createLoanSchema = z.object({
  label: z.string().min(1),
  lender: z.string().min(1),
  loanType: z.enum(["AMORTISSABLE", "IN_FINE", "BULLET", "OBLIGATION", "COMPTE_COURANT"]),
  amount: z.number().positive(),
  interestRate: z.number().min(0),
  insuranceRate: z.number().min(0).default(0),
  durationMonths: z.number().int().positive(),
  startDate: z.string().min(1),
  buildingId: z.string().min(1).optional().nullable(),
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

export const createLoanFromPdfSchema = z.object({
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

export const updateLoanSchema = z.object({
  label: z.string().min(1, "Libellé requis"),
  lender: z.string().min(1, "Établissement prêteur requis"),
  amount: z.number().positive("Le capital emprunté doit être positif"),
  interestRate: z.number().min(0, "Le taux nominal doit être >= 0"),
  insuranceRate: z.number().min(0).default(0),
  durationMonths: z.number().int().positive("La durée doit être positive"),
  startDate: z.string().min(1, "La date de début est requise"),
  purchaseValue: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  partnerName: z.string().optional().nullable(),
  partnerShare: z.number().min(0).max(100).optional().nullable(),
  maxAmount: z.number().positive().optional().nullable(),
  conventionDate: z.string().optional().nullable(),
  nominalValue: z.number().positive().optional().nullable(),
  bondCount: z.number().int().positive().optional().nullable(),
  couponFrequency: z.enum(["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"]).optional().nullable(),
  issuePrice: z.number().positive().optional().nullable(),
});

export const budgetLineSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional().nullable(),
  accountId: z.string().cuid(),
  budgetAmount: z.number(),
  label: z.string().optional().nullable(),
});

export const addMovementSchema = z.object({
  loanId: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(["APPORT", "RETRAIT", "INTERETS"]),
  amount: z.number().positive("Le montant doit être positif"),
  description: z.string().optional().nullable(),
});
