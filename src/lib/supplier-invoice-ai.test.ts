import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
  },
}));

import { analyzeSupplierInvoice } from "./supplier-invoice-ai";

const PDF_BUFFER = Buffer.from("fake-pdf-content");

function makeResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 200, output_tokens: 100 },
  };
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
});

describe("analyzeSupplierInvoice", () => {
  it("lève une erreur si ANTHROPIC_API_KEY est absente", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    await expect(analyzeSupplierInvoice(PDF_BUFFER, "application/pdf")).rejects.toThrow(
      "ANTHROPIC_API_KEY manquante"
    );
  });

  it("parse correctement une facture bien structurée", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeResponse(JSON.stringify({
        supplierName: "Électricité Martin SARL",
        supplierSiret: "12345678901234",
        invoiceNumber: "FACT-2025-042",
        invoiceDate: "2025-03-15",
        dueDate: "2025-04-15",
        amountHT: 1000,
        amountVAT: 200,
        amountTTC: 1200,
        vatRate: 20,
        currency: "EUR",
        supplierIban: "FR76 1234 5678 9012 3456 7890 189",
        supplierBic: "BNPAFRPP",
        supplierAddress: "12 rue de la Paix, 75001 Paris",
        description: "Travaux électriques",
        periodStart: null,
        periodEnd: null,
      }))
    );

    const result = await analyzeSupplierInvoice(PDF_BUFFER, "application/pdf");
    expect(result.supplierName).toBe("Électricité Martin SARL");
    expect(result.invoiceNumber).toBe("FACT-2025-042");
    expect(result.amountTTC).toBe(1200);
    expect(result.vatRate).toBe(20);
    // IBAN doit être sans espaces
    expect(result.supplierIban).toBe("FR76123456789012345678901 89".replace(/\s/g, ""));
  });

  it("supprime les espaces de l'IBAN", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeResponse(JSON.stringify({
        supplierIban: "FR76 1234 5678 9012 3456 7890 189",
      }))
    );

    const result = await analyzeSupplierInvoice(PDF_BUFFER, "application/pdf");
    expect(result.supplierIban).not.toContain(" ");
  });

  it("retourne un résultat vide si le JSON est invalide", async () => {
    mockMessagesCreate.mockResolvedValue(makeResponse("Texte non JSON du tout"));

    const result = await analyzeSupplierInvoice(PDF_BUFFER, "application/pdf");
    expect(result.supplierName).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("calcule la confiance selon le nombre de champs remplis", async () => {
    // 8 champs sur 16 → confidence = 0.5
    mockMessagesCreate.mockResolvedValue(
      makeResponse(JSON.stringify({
        supplierName: "Test",
        supplierSiret: "12345678901234",
        invoiceNumber: "FACT-001",
        invoiceDate: "2025-01-01",
        dueDate: "2025-02-01",
        amountHT: 100,
        amountVAT: 20,
        amountTTC: 120,
        vatRate: null,
        supplierIban: null,
        supplierBic: null,
        supplierAddress: null,
        description: null,
        periodStart: null,
        periodEnd: null,
        currency: "EUR",
      }))
    );

    const result = await analyzeSupplierInvoice(PDF_BUFFER, "application/pdf");
    expect(result.confidence).toBe(0.5);
  });

  it("retourne EUR par défaut si la devise est absente", async () => {
    mockMessagesCreate.mockResolvedValue(makeResponse(JSON.stringify({ supplierName: "Test" })));

    const result = await analyzeSupplierInvoice(PDF_BUFFER, "application/pdf");
    expect(result.currency).toBe("EUR");
  });

  it("gère les types MIME image (PNG, WebP, JPEG) — ligne 55", async () => {
    mockMessagesCreate.mockResolvedValue(makeResponse(JSON.stringify({ supplierName: "Test PNG" })));
    const png = await analyzeSupplierInvoice(Buffer.from("img"), "image/png");
    expect(png.supplierName).toBe("Test PNG");

    mockMessagesCreate.mockResolvedValue(makeResponse(JSON.stringify({ supplierName: "Test WebP" })));
    const webp = await analyzeSupplierInvoice(Buffer.from("img"), "image/webp");
    expect(webp.supplierName).toBe("Test WebP");

    mockMessagesCreate.mockResolvedValue(makeResponse(JSON.stringify({ supplierName: "Test JPEG" })));
    const jpeg = await analyzeSupplierInvoice(Buffer.from("img"), "image/jpeg");
    expect(jpeg.supplierName).toBe("Test JPEG");
  });

  it("retourne un résultat vide en cas d'exception Anthropic", async () => {
    mockMessagesCreate.mockRejectedValue(new Error("API unavailable"));

    const result = await analyzeSupplierInvoice(PDF_BUFFER, "application/pdf");
    expect(result.confidence).toBe(0);
    expect(result.supplierName).toBeNull();
  });
});
