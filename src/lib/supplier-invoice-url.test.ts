import { describe, expect, it } from "vitest";
import { buildPrepareSupplierPaymentsHref, buildSupplierInvoicesHref } from "./supplier-invoice-url";

describe("buildSupplierInvoicesHref", () => {
  it("préserve les filtres métier et bancaires dans l'URL fournisseurs", () => {
    expect(
      buildSupplierInvoicesHref({
        page: 2,
        status: "VALIDATED",
        search: "edf & syndic",
        bankAccountIds: ["bank-1", "bank-2"],
      })
    ).toBe(
      "/banque/factures-fournisseurs?page=2&status=VALIDATED&search=edf+%26+syndic&bankAccountIds=bank-1%2Cbank-2"
    );
  });

  it("ignore les filtres vides", () => {
    expect(buildSupplierInvoicesHref({ page: 1, status: "", search: "", bankAccountIds: [] })).toBe(
      "/banque/factures-fournisseurs?page=1"
    );
  });
});

describe("buildPrepareSupplierPaymentsHref", () => {
  it("force la file validée en conservant les comptes bancaires", () => {
    expect(buildPrepareSupplierPaymentsHref(["bank-1", "bank-2"])).toBe(
      "/banque/factures-fournisseurs?status=VALIDATED&bankAccountIds=bank-1%2Cbank-2"
    );
  });
});
