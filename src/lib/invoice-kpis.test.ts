import { describe, expect, it } from "vitest";
import {
  formatCurrencyAmountFr,
  isIssuedInvoiceForBillingKpi,
  roundCurrency,
  sumInvoiceTotalTTC,
} from "./invoice-kpis";

describe("invoice KPI helpers", () => {
  it("exclut les brouillons, annulations, avoirs et quittances du total facture", () => {
    expect(isIssuedInvoiceForBillingKpi({ invoiceType: "APPEL_LOYER", status: "VALIDEE" })).toBe(true);
    expect(isIssuedInvoiceForBillingKpi({ invoiceType: "DEPOT_DE_GARANTIE", status: "PAYE" })).toBe(true);
    expect(isIssuedInvoiceForBillingKpi({ invoiceType: "APPEL_LOYER", status: "BROUILLON" })).toBe(false);
    expect(isIssuedInvoiceForBillingKpi({ invoiceType: "APPEL_LOYER", status: "ANNULEE" })).toBe(false);
    expect(isIssuedInvoiceForBillingKpi({ invoiceType: "AVOIR", status: "VALIDEE" })).toBe(false);
    expect(isIssuedInvoiceForBillingKpi({ invoiceType: "QUITTANCE", status: "VALIDEE" })).toBe(false);
  });

  it("arrondit les additions TTC à deux décimales", () => {
    expect(roundCurrency(4207.855)).toBe(4207.86);
    expect(sumInvoiceTotalTTC([{ totalTTC: 4207.855 }, { totalTTC: 6272.65625 }])).toBe(10480.52);
  });

  it("formate les montants en euros avec deux décimales", () => {
    expect(formatCurrencyAmountFr(56819.22855)).toBe("56\u202f819,23 €");
  });
});
