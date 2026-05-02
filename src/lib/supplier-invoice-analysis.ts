type AnalyzeResponseBody = {
  ok?: boolean;
  error?: string;
};

export type SupplierInvoiceAnalyzeParseResult =
  | { success: true }
  | { success: false; error: string };

export async function parseSupplierInvoiceAnalyzeResponse(
  response: Response
): Promise<SupplierInvoiceAnalyzeParseResult> {
  const body = await response.json().catch((): AnalyzeResponseBody => ({}));
  const error = typeof body.error === "string" && body.error.trim().length > 0
    ? body.error
    : "Analyse IA impossible";

  if (!response.ok || body.ok === false) {
    return { success: false, error };
  }

  return { success: true };
}
