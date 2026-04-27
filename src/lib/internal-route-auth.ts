export function isAnalyzeApiRoute(pathname: string): boolean {
  return (
    /^\/api\/documents\/[^/]+\/analyze$/.test(pathname) ||
    /^\/api\/supplier-invoices\/[^/]+\/analyze$/.test(pathname)
  );
}
