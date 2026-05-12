"use server";

import { prisma } from "@/lib/prisma";
import {
  getOptionalSocietyActionContext,
} from "@/lib/action-society";

export async function getLoans(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

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

export async function getLoansForDebtProfile(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  // Fetch lines from 2 months ago onward so we have the last paid line (for currentCrd)
  // plus all future lines (for the extinction curve).
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  twoMonthsAgo.setDate(1);
  twoMonthsAgo.setHours(0, 0, 0, 0);

  return prisma.loan.findMany({
    where: {
      societyId,
      status: "EN_COURS",
      loanType: { not: "COMPTE_COURANT" },
    },
    select: {
      id: true,
      label: true,
      lender: true,
      amount: true,
      status: true,
      loanType: true,
      startDate: true,
      endDate: true,
      durationMonths: true,
      amortizationLines: {
        where: { dueDate: { gte: twoMonthsAgo } },
        orderBy: { period: "asc" },
        select: { period: true, dueDate: true, remainingBalance: true },
      },
    },
    orderBy: { endDate: "asc" },
  });
}

export async function getLoanById(societyId: string, loanId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  return prisma.loan.findFirst({
    where: { id: loanId, societyId },
    include: {
      building: { select: { id: true, name: true, city: true } },
      amortizationLines: { orderBy: { period: "asc" } },
      movements: { orderBy: { date: "desc" } },
    },
  });
}


export async function getLoanMovements(societyId: string, loanId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.loanMovement.findMany({
    where: { loanId, loan: { societyId } },
    orderBy: { date: "desc" },
  });
}


export async function getBudgetLines(societyId: string, year: number) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.budgetLine.findMany({
    where: { societyId, year },
    include: {
      account: { select: { id: true, code: true, label: true, type: true } },
    },
    orderBy: [{ account: { code: "asc" } }, { month: "asc" }],
  });
}
