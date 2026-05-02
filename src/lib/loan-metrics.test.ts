import { describe, expect, it } from "vitest";
import { calculateLoanRepaymentMetrics } from "@/lib/loan-metrics";

const baseLine = {
  interestPayment: 100,
  insurancePayment: 0,
  totalPayment: 1_000,
  remainingBalance: 0,
  isPaid: false,
  paidAt: null,
  principalPaidAt: null,
  interestPaidAt: null,
  insurancePaidAt: null,
};

describe("calculateLoanRepaymentMetrics", () => {
  it("calcule le capital restant dû sur les capitaux pointés, pas sur le calendrier théorique", () => {
    const metrics = calculateLoanRepaymentMetrics({
      loanAmount: 10_000,
      asOf: new Date("2026-05-02"),
      lines: [
        {
          ...baseLine,
          period: 1,
          dueDate: new Date("2026-02-05"),
          principalPayment: 1_000,
          remainingBalance: 9_000,
          isPaid: true,
          paidAt: new Date("2026-02-05"),
        },
        {
          ...baseLine,
          period: 2,
          dueDate: new Date("2026-03-05"),
          principalPayment: 1_000,
          remainingBalance: 8_000,
          interestPaidAt: new Date("2026-03-05"),
        },
        {
          ...baseLine,
          period: 3,
          dueDate: new Date("2026-04-05"),
          principalPayment: 1_000,
          remainingBalance: 7_000,
        },
      ],
    });

    expect(metrics.paidPrincipal).toBe(1_000);
    expect(metrics.reconciledRemainingBalance).toBe(9_000);
    expect(metrics.theoreticalRemainingBalance).toBe(7_000);
    expect(metrics.fullyPaidLinesCount).toBe(1);
    expect(metrics.partiallyPaidLinesCount).toBe(1);
    expect(metrics.dueUnreconciledLinesCount).toBe(2);
    expect(metrics.hasReconciliationWarning).toBe(true);
  });

  it("réduit le CRD pointé dès que le composant capital est rapproché même si les intérêts restent à pointer", () => {
    const metrics = calculateLoanRepaymentMetrics({
      loanAmount: 10_000,
      asOf: new Date("2026-03-10"),
      lines: [
        {
          ...baseLine,
          period: 1,
          dueDate: new Date("2026-03-05"),
          principalPayment: 1_000,
          interestPayment: 100,
          remainingBalance: 9_000,
          principalPaidAt: new Date("2026-03-05"),
        },
      ],
    });

    expect(metrics.paidPrincipal).toBe(1_000);
    expect(metrics.reconciledRemainingBalance).toBe(9_000);
    expect(metrics.fullyPaidLinesCount).toBe(0);
    expect(metrics.partiallyPaidLinesCount).toBe(1);
    expect(metrics.hasReconciliationWarning).toBe(true);
  });
});
