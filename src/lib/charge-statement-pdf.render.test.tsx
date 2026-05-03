import type { ReactElement, ReactNode } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { ChargeStatementPdf, type ChargeStatementPdfData } from "./charge-statement-pdf";

function chargeStatementData(overrides: Partial<ChargeStatementPdfData> = {}): ChargeStatementPdfData {
  return {
    fiscalYear: 2024,
    periodStart: "2024-01-01T00:00:00.000Z",
    periodEnd: "2024-12-31T23:59:59.000Z",
    tenantName: "Locataire Exemple",
    lotNumber: "A1",
    buildingName: "Residence Test",
    totalCharges: 1200,
    totalProvisions: 1200,
    balance: 0,
    categories: [
      {
        categoryName: "Eau froide",
        nature: "RECUPERABLE",
        totalAmount: 1200,
        recoverableAmount: 1200,
        allocationMethod: "COMPTEUR",
        allocationRate: 50,
        tenantShare: 600,
      },
    ],
    prorataDays: 183,
    society: {
      name: "SCI Test",
      addressLine1: "1 rue Test",
      postalCode: "75001",
      city: "Paris",
      email: "contact@example.test",
    },
    ...overrides,
  };
}

function collectText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && "props" in node) {
    return collectText((node as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return "";
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

describe("ChargeStatementPdf", () => {
  it("affiche un solde nul sans le presenter comme un avoir", () => {
    const text = normalizeText(collectText(ChargeStatementPdf({ data: chargeStatementData({ balance: 0 }) })));

    expect(text).toContain("Solde nul");
    expect(text).not.toContain("Avoir a rembourser");
  });

  it("mentionne la mise a disposition des justificatifs et le prorata sur 366 jours", () => {
    const text = normalizeText(collectText(ChargeStatementPdf({ data: chargeStatementData() })));

    expect(text).toContain("justificatifs");
    expect(text).toContain("183 jours sur 366");
  });

  it("produit un vrai PDF exploitable", async () => {
    const buffer = await renderToBuffer(
      <ChargeStatementPdf data={chargeStatementData()} /> as ReactElement<DocumentProps>
    );

    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1_500);
    expect(buffer.includes(Buffer.from("%%EOF"))).toBe(true);
  }, 20_000);
});
