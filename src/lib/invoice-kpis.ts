type InvoiceKpiInput = {
  invoiceType: string;
  status: string;
  totalTTC: number;
};

const EXCLUDED_TOTAL_TYPES = new Set(["AVOIR", "QUITTANCE"]);
const EXCLUDED_TOTAL_STATUSES = new Set(["BROUILLON", "ANNULEE"]);

export function roundCurrency(amount: number): number {
  const cents = Math.round((Math.abs(amount) + 1e-9) * 100);
  return amount < 0 ? -cents / 100 : cents / 100;
}

export function isIssuedInvoiceForBillingKpi(invoice: Pick<InvoiceKpiInput, "invoiceType" | "status">): boolean {
  return !EXCLUDED_TOTAL_TYPES.has(invoice.invoiceType) && !EXCLUDED_TOTAL_STATUSES.has(invoice.status);
}

export function sumInvoiceTotalTTC(invoices: Pick<InvoiceKpiInput, "totalTTC">[]): number {
  return roundCurrency(invoices.reduce((sum, invoice) => sum + roundCurrency(invoice.totalTTC), 0));
}

export function formatCurrencyAmountFr(amount: number): string {
  return `${roundCurrency(amount).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}
