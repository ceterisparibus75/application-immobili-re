import { describe, it, expect, vi } from "vitest";

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
  },
}));
vi.mock("@/lib/env", () => ({
  env: { ANTHROPIC_API_KEY: "sk-ant-test" },
}));
vi.mock("@/lib/ai-logger", () => ({
  logAiCall: vi.fn(),
}));

import { analyzeManagementReport, analyzeAgencyInvoice } from "./management-report-ai";

const PDF_BUFFER = Buffer.from("fake-pdf-content");
const LEASE_CONTEXT = {
  tenantName: "Jean Dupont",
  lotLabel: "Lot 12 - 12 rue de la Paix",
  currentRentHT: 800,
  managementFeeValue: 8,
  managementFeeType: "POURCENTAGE",
};

function makeResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 200, output_tokens: 100 },
  };
}

// ── analyzeManagementReport ────────────────────────────────────

describe("analyzeManagementReport", () => {
  it("parse correctement un compte-rendu de gestion", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeResponse(JSON.stringify({
        periodStart: "2025-01-01",
        periodEnd: "2025-01-31",
        grossRent: 800,
        chargesAmount: 50,
        feeAmountHT: 64,
        feeAmountTTC: 76.8,
        netTransfer: 786,
        agencyName: "Agence Dupont Immobilier",
        alerts: [],
        confidence: 0.95,
      }))
    );

    const result = await analyzeManagementReport(PDF_BUFFER, "application/pdf", LEASE_CONTEXT);
    expect(result.grossRent).toBe(800);
    expect(result.netTransfer).toBe(786);
    expect(result.agencyName).toBe("Agence Dupont Immobilier");
    expect(result.alerts).toEqual([]);
    expect(result.confidence).toBe(0.95);
  });

  it("retourne des valeurs nulles si le JSON est absent", async () => {
    mockMessagesCreate.mockResolvedValue(makeResponse("Texte non JSON"));

    const result = await analyzeManagementReport(PDF_BUFFER, "application/pdf", LEASE_CONTEXT);
    expect(result.grossRent).toBeNull();
    expect(result.netTransfer).toBeNull();
    expect(result.alerts).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it("retourne les alertes détectées", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeResponse(JSON.stringify({
        grossRent: 750,
        alerts: ["Loyer encaissé (750 EUR) inférieur au loyer attendu (800 EUR)"],
        confidence: 0.9,
      }))
    );

    const result = await analyzeManagementReport(PDF_BUFFER, "application/pdf", LEASE_CONTEXT);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]).toContain("750");
  });
});

// ── analyzeAgencyInvoice ───────────────────────────────────────

describe("analyzeAgencyInvoice", () => {
  it("parse correctement une facture d'honoraires", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeResponse(JSON.stringify({
        montantHT: 64,
        tva: 12.8,
        montantTTC: 76.8,
        agencyName: "Agence Test",
        invoiceNumber: "FAC-2025-001",
        period: "Janvier 2025",
        date: "2025-01-31",
        confidence: 0.92,
      }))
    );

    const result = await analyzeAgencyInvoice(PDF_BUFFER, "application/pdf");
    expect(result.montantHT).toBe(64);
    expect(result.montantTTC).toBe(76.8);
    expect(result.agencyName).toBe("Agence Test");
    expect(result.confidence).toBe(0.92);
  });

  it("retourne des valeurs nulles si la réponse est invalide", async () => {
    mockMessagesCreate.mockResolvedValue(makeResponse("non-json-response"));

    const result = await analyzeAgencyInvoice(PDF_BUFFER, "image/jpeg");
    expect(result.montantHT).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("gère les types MIME image/png et image/webp (lignes 43-44)", async () => {
    mockMessagesCreate.mockResolvedValue(makeResponse(JSON.stringify({ montantHT: 50, confidence: 0.8 })));
    const png = await analyzeAgencyInvoice(PDF_BUFFER, "image/png");
    expect(png.montantHT).toBe(50);

    mockMessagesCreate.mockResolvedValue(makeResponse(JSON.stringify({ montantHT: 60, confidence: 0.9 })));
    const webp = await analyzeAgencyInvoice(PDF_BUFFER, "image/webp");
    expect(webp.montantHT).toBe(60);
  });
});
