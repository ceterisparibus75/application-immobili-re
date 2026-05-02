export type LoanRepaymentMetricLine = {
  period: number;
  dueDate: Date | string;
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  remainingBalance: number;
  isPaid: boolean;
  paidAt: Date | string | null;
  principalPaidAt?: Date | string | null;
  interestPaidAt?: Date | string | null;
  insurancePaidAt?: Date | string | null;
};

export type LoanRepaymentMetrics = {
  paidPrincipal: number;
  reconciledRemainingBalance: number;
  theoreticalRemainingBalance: number;
  fullyPaidLinesCount: number;
  partiallyPaidLinesCount: number;
  dueUnreconciledLinesCount: number;
  dueUnreconciledAmount: number;
  hasReconciliationWarning: boolean;
};

type ComponentKey = "principal" | "interest" | "insurance";

const COMPONENTS: Array<{
  key: ComponentKey;
  amountField: "principalPayment" | "interestPayment" | "insurancePayment";
  paidAtField: "principalPaidAt" | "interestPaidAt" | "insurancePaidAt";
}> = [
  { key: "principal", amountField: "principalPayment", paidAtField: "principalPaidAt" },
  { key: "interest", amountField: "interestPayment", paidAtField: "interestPaidAt" },
  { key: "insurance", amountField: "insurancePayment", paidAtField: "insurancePaidAt" },
];

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPositiveAmount(value: number): boolean {
  return roundCents(value) > 0.01;
}

function isComponentPaid(line: LoanRepaymentMetricLine, component: (typeof COMPONENTS)[number]): boolean {
  if (!isPositiveAmount(line[component.amountField])) return true;
  if (line.isPaid) return true;
  return Boolean(line[component.paidAtField]);
}

function isLineFullyPaid(line: LoanRepaymentMetricLine): boolean {
  return COMPONENTS.every((component) => isComponentPaid(line, component));
}

function isLinePartiallyPaid(line: LoanRepaymentMetricLine): boolean {
  if (isLineFullyPaid(line)) return false;
  return COMPONENTS.some((component) => {
    if (!isPositiveAmount(line[component.amountField])) return false;
    return Boolean(line[component.paidAtField]);
  });
}

function unpaidDueAmount(line: LoanRepaymentMetricLine): number {
  return COMPONENTS.reduce((sum, component) => {
    if (isComponentPaid(line, component)) return sum;
    return sum + line[component.amountField];
  }, 0);
}

export function calculateLoanRepaymentMetrics({
  loanAmount,
  lines,
  asOf = new Date(),
}: {
  loanAmount: number;
  lines: LoanRepaymentMetricLine[];
  asOf?: Date;
}): LoanRepaymentMetrics {
  const paidPrincipal = roundCents(
    lines.reduce((sum, line) => {
      if (isComponentPaid(line, COMPONENTS[0])) return sum + line.principalPayment;
      return sum;
    }, 0)
  );

  const dueLines = lines.filter((line) => new Date(line.dueDate).getTime() <= asOf.getTime());
  const lastDueLine = dueLines[dueLines.length - 1];
  const theoreticalRemainingBalance = roundCents(lastDueLine?.remainingBalance ?? loanAmount);
  const reconciledRemainingBalance = roundCents(Math.max(0, loanAmount - paidPrincipal));
  const fullyPaidLinesCount = lines.filter((line) => isLineFullyPaid(line)).length;
  const partiallyPaidLinesCount = lines.filter((line) => isLinePartiallyPaid(line)).length;
  const dueUnreconciledLines = dueLines.filter((line) => !isLineFullyPaid(line));
  const dueUnreconciledAmount = roundCents(
    dueUnreconciledLines.reduce((sum, line) => sum + unpaidDueAmount(line), 0)
  );

  return {
    paidPrincipal,
    reconciledRemainingBalance,
    theoreticalRemainingBalance,
    fullyPaidLinesCount,
    partiallyPaidLinesCount,
    dueUnreconciledLinesCount: dueUnreconciledLines.length,
    dueUnreconciledAmount,
    hasReconciliationWarning:
      dueUnreconciledLines.length > 0 ||
      Math.abs(reconciledRemainingBalance - theoreticalRemainingBalance) > 0.01,
  };
}
