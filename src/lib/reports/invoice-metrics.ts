export const REPORT_REVENUE_INVOICE_TYPES = [
  "APPEL_LOYER",
  "REGULARISATION_CHARGES",
  "REFACTURATION",
] as const;

export const REPORT_ACTIVE_INVOICE_STATUSES = [
  "VALIDEE",
  "ENVOYEE",
  "EN_ATTENTE",
  "EN_RETARD",
  "PARTIELLEMENT_PAYE",
  "RELANCEE",
  "LITIGIEUX",
  "PAYE",
] as const;

export const REPORT_OUTSTANDING_INVOICE_STATUSES = [
  "VALIDEE",
  "ENVOYEE",
  "EN_ATTENTE",
  "EN_RETARD",
  "PARTIELLEMENT_PAYE",
  "RELANCEE",
  "LITIGIEUX",
] as const;

export type ReportInvoiceWithPayments = {
  totalTTC: number;
  isThirdPartyManaged?: boolean | null;
  expectedNetAmount?: number | null;
  payments?: Array<{ amount: number | null; paidAt?: Date | string | null }> | null;
};

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function getPaidAmount(invoice: ReportInvoiceWithPayments): number {
  return roundCurrency(
    (invoice.payments ?? []).reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
  );
}

export function getPaidAmountInPeriod(invoice: ReportInvoiceWithPayments, from: Date, to: Date): number {
  return roundCurrency(
    (invoice.payments ?? []).reduce((sum, payment) => {
      if (!payment.paidAt) return sum;
      const paidAt = new Date(payment.paidAt);
      if (paidAt < from || paidAt > to) return sum;
      return sum + (payment.amount ?? 0);
    }, 0)
  );
}

export function getOutstandingAmount(invoice: ReportInvoiceWithPayments): number {
  const targetAmount = invoice.isThirdPartyManaged && typeof invoice.expectedNetAmount === "number"
    ? invoice.expectedNetAmount
    : invoice.totalTTC;
  return Math.max(0, roundCurrency(targetAmount - getPaidAmount(invoice)));
}
