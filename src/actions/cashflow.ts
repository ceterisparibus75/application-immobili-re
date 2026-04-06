"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";

export type CashflowMonth = {
  month: string;
  projectedIncome: number;
  projectedExpenses: number;
  netCashflow: number;
  actualIncome?: number;
  actualExpenses?: number;
};

export type CashflowForecast = {
  months: CashflowMonth[];
};

/**
 * Compute projected cash flow for a society over N months.
 *
 * - Projected income: sum of monthly rents from all active leases
 * - Projected expenses: loan payments (from amortization lines) + recurring charges (prorated monthly from Charge model)
 * - Historical actuals: last 6 months of paid invoices (income) and paid charges (expenses)
 */
export async function getCashflowForecast(
  societyId: string,
  months: number = 12
): Promise<ActionResult<CashflowForecast>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based

    // ── Active leases for projected income ──
    const activeLeases = await prisma.lease.findMany({
      where: { societyId, status: "EN_COURS" },
      select: { currentRentHT: true, vatApplicable: true, vatRate: true },
    });

    // Monthly projected income = sum of all active lease rents (TTC if VAT applicable)
    const monthlyProjectedIncome = activeLeases.reduce((sum, lease) => {
      const rentTTC = lease.vatApplicable
        ? lease.currentRentHT * (1 + lease.vatRate / 100)
        : lease.currentRentHT;
      return sum + rentTTC;
    }, 0);

    // ── Loan amortization lines for projected expenses ──
    const forecastStart = new Date(currentYear, currentMonth, 1);
    const forecastEnd = new Date(currentYear, currentMonth + months, 0, 23, 59, 59);

    const loanLines = await prisma.loanAmortizationLine.findMany({
      where: {
        loan: { societyId, status: "EN_COURS" },
        dueDate: { gte: forecastStart, lte: forecastEnd },
      },
      select: { dueDate: true, totalPayment: true },
    });

    // Group loan payments by month key
    const loanByMonth = new Map<string, number>();
    for (const line of loanLines) {
      const d = new Date(line.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      loanByMonth.set(key, (loanByMonth.get(key) ?? 0) + line.totalPayment);
    }

    // ── Recurring charges: prorate charges over their period ──
    const charges = await prisma.charge.findMany({
      where: {
        societyId,
        OR: [
          { periodEnd: { gte: forecastStart } },
          { periodStart: { lte: forecastEnd } },
        ],
      },
      select: { amount: true, periodStart: true, periodEnd: true },
    });

    // Distribute each charge amount evenly across the months it covers
    const chargeByMonth = new Map<string, number>();
    for (const charge of charges) {
      const pStart = new Date(charge.periodStart);
      const pEnd = new Date(charge.periodEnd);
      // Count total months in the charge period
      const totalMonths = Math.max(
        1,
        (pEnd.getFullYear() - pStart.getFullYear()) * 12 + (pEnd.getMonth() - pStart.getMonth()) + 1
      );
      const monthlyAmount = charge.amount / totalMonths;

      // Iterate over each month in the charge period that overlaps with the forecast
      const iterStart = new Date(Math.max(pStart.getTime(), forecastStart.getTime()));
      const iterEnd = new Date(Math.min(pEnd.getTime(), forecastEnd.getTime()));
      const mStart = new Date(iterStart.getFullYear(), iterStart.getMonth(), 1);
      while (mStart <= iterEnd) {
        const key = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`;
        chargeByMonth.set(key, (chargeByMonth.get(key) ?? 0) + monthlyAmount);
        mStart.setMonth(mStart.getMonth() + 1);
      }
    }

    // ── Historical actuals (last 6 months) ──
    const sixMonthsAgo = new Date(currentYear, currentMonth - 6, 1);

    // Actual income: paid invoices
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        societyId,
        invoiceType: { not: "AVOIR" },
        status: { in: ["PAYE", "PARTIELLEMENT_PAYE"] },
        issueDate: { gte: sixMonthsAgo, lt: forecastStart },
      },
      select: { issueDate: true, totalTTC: true },
    });

    const actualIncomeByMonth = new Map<string, number>();
    for (const inv of paidInvoices) {
      const d = new Date(inv.issueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      actualIncomeByMonth.set(key, (actualIncomeByMonth.get(key) ?? 0) + inv.totalTTC);
    }

    // Actual expenses: paid charges
    const paidCharges = await prisma.charge.findMany({
      where: {
        societyId,
        isPaid: true,
        date: { gte: sixMonthsAgo, lt: forecastStart },
      },
      select: { date: true, amount: true },
    });

    const actualExpenseByMonth = new Map<string, number>();
    for (const ch of paidCharges) {
      const d = new Date(ch.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      actualExpenseByMonth.set(key, (actualExpenseByMonth.get(key) ?? 0) + ch.amount);
    }

    // ── Build result array ──
    const result: CashflowMonth[] = [];

    // Include historical months (up to 6 months back)
    for (let i = -6; i < 0; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      if (d < sixMonthsAgo) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const actualIncome = actualIncomeByMonth.get(key) ?? 0;
      const actualExpenses = actualExpenseByMonth.get(key) ?? 0;

      result.push({
        month: label,
        projectedIncome: monthlyProjectedIncome,
        projectedExpenses: Math.round(((loanByMonth.get(key) ?? 0) + (chargeByMonth.get(key) ?? 0)) * 100) / 100,
        netCashflow: Math.round((monthlyProjectedIncome - ((loanByMonth.get(key) ?? 0) + (chargeByMonth.get(key) ?? 0))) * 100) / 100,
        actualIncome: Math.round(actualIncome * 100) / 100,
        actualExpenses: Math.round(actualExpenses * 100) / 100,
      });
    }

    // Future months
    for (let i = 0; i < months; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

      const loanExpense = loanByMonth.get(key) ?? 0;
      const chargeExpense = chargeByMonth.get(key) ?? 0;
      const totalExpenses = loanExpense + chargeExpense;

      result.push({
        month: label,
        projectedIncome: Math.round(monthlyProjectedIncome * 100) / 100,
        projectedExpenses: Math.round(totalExpenses * 100) / 100,
        netCashflow: Math.round((monthlyProjectedIncome - totalExpenses) * 100) / 100,
      });
    }

    return { success: true, data: { months: result } };
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      const err = error as { message: string };
      if (err.message.includes("Forbidden") || err.message.includes("interdit")) {
        return { success: false, error: err.message };
      }
    }
    console.error("[getCashflowForecast]", error);
    return { success: false, error: "Erreur lors du calcul du cash-flow prévisionnel" };
  }
}
