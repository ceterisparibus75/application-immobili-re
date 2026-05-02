type SupplierInvoicesHrefParams = {
  page?: number;
  status?: string;
  search?: string;
  bankAccountIds?: string[];
};

export function buildSupplierInvoicesHref(params: SupplierInvoicesHrefParams = {}): string {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);
  if (params.bankAccountIds && params.bankAccountIds.length > 0) {
    searchParams.set("bankAccountIds", params.bankAccountIds.join(","));
  }

  const query = searchParams.toString();
  return query ? `/banque/factures-fournisseurs?${query}` : "/banque/factures-fournisseurs";
}

export function buildPrepareSupplierPaymentsHref(bankAccountIds: string[] = []): string {
  return buildSupplierInvoicesHref({ status: "VALIDATED", bankAccountIds });
}
