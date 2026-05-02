import { describe, expect, it } from "vitest";
import { parseSupplierInvoiceAnalyzeResponse } from "./supplier-invoice-analysis";

describe("parseSupplierInvoiceAnalyzeResponse", () => {
  it("retourne une erreur lisible quand la route d'analyse échoue", async () => {
    const result = await parseSupplierInvoiceAnalyzeResponse(
      Response.json({ error: "Analyse IA sans données exploitables" }, { status: 422 })
    );

    expect(result).toEqual({
      success: false,
      error: "Analyse IA sans données exploitables",
    });
  });
});
