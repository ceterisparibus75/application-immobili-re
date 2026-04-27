export function hasValidInternalSecret(
  provided: string | null | undefined,
  expected = process.env.CRON_SECRET
): boolean {
  if (!provided || !expected) return false;
  const token = provided.startsWith("Bearer ") ? provided.slice(7) : provided;
  return token.length === expected.length && token === expected;
}

export function isInternalAnalyzeRequest(
  pathname: string,
  getHeader: (name: string) => string | null
): boolean {
  const isDocumentAnalyze = /^\/api\/documents\/[^/]+\/analyze$/.test(pathname);
  if (isDocumentAnalyze) {
    return hasValidInternalSecret(getHeader("x-cron-secret"));
  }

  const isSupplierInvoiceAnalyze = /^\/api\/supplier-invoices\/[^/]+\/analyze$/.test(pathname);
  if (isSupplierInvoiceAnalyze) {
    return hasValidInternalSecret(getHeader("authorization"));
  }

  return false;
}
