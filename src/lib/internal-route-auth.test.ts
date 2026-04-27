import { describe, expect, it } from "vitest";
import { isAnalyzeApiRoute } from "./internal-route-auth";

describe("internal-route-auth", () => {
  it("identifie les routes d'analyse qui gerent leur propre auth", () => {
    expect(isAnalyzeApiRoute("/api/documents/doc-1/analyze")).toBe(true);
    expect(isAnalyzeApiRoute("/api/supplier-invoices/inv-1/analyze")).toBe(true);
  });

  it("ignore les routes voisines", () => {
    expect(isAnalyzeApiRoute("/api/documents/doc-1/chat")).toBe(false);
    expect(isAnalyzeApiRoute("/api/documents/doc-1/analyze/extra")).toBe(false);
    expect(isAnalyzeApiRoute("/api/supplier-invoices/inv-1/sepa-xml")).toBe(false);
  });
});
