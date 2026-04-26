import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { InvoicePdf, type InvoicePdfData } from "./invoice-pdf";

function invoicePdfData(overrides: Partial<InvoicePdfData> = {}): InvoicePdfData {
  return {
    invoiceNumber: "FAC-2026-0999",
    invoiceType: "APPEL_LOYER",
    issueDate: "2026-04-26T00:00:00.000Z",
    dueDate: "2026-05-01T00:00:00.000Z",
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-05-31T00:00:00.000Z",
    totalHT: 1200,
    totalVAT: 240,
    totalTTC: 1440,
    previousBalance: 180,
    isAvoir: false,
    society: {
      name: "SCI Atlas",
      addressLine1: "1 rue de Paris",
      postalCode: "75001",
      city: "Paris",
      country: "France",
      phone: "0102030405",
      siret: "12345678901234",
      vatNumber: "FR12123456789",
      legalForm: "SCI",
      shareCapital: 10000,
      bankName: "Banque Test",
      vatRegime: "NORMAL",
      legalMentions: "Mention contractuelle de test",
      signatoryName: "Maxime Langet",
      logoSignedUrl: null,
      iban: "FR7612345678901234567890185",
      bic: "TESTFRPPXXX",
      email: "contact@sci-atlas.test",
    },
    tenant: {
      name: "Locataire Exemple SAS",
      address: "10 avenue du Bail, 75002 Paris",
      email: "locataire@example.test",
    },
    lotLabel: "Lot A1 - 1 rue de Paris, 75001 Paris",
    lines: [
      { label: "Loyer mai 2026", lotNumber: "A1", totalHT: 1000, vatRate: 20, totalTTC: 1200 },
      { label: "Provision sur charges", lotNumber: "A1", totalHT: 200, vatRate: 20, totalTTC: 240 },
    ],
    payments: [{ paidAt: "2026-04-20T00:00:00.000Z", method: "Virement", amount: 100 }],
    creditNoteForNumber: null,
    ...overrides,
  };
}

describe("InvoicePdf rendu end-to-end", () => {
  it("produit un vrai PDF exploitable pour une facture métier complète", async () => {
    const buffer = await renderToBuffer(
      React.createElement(InvoicePdf, { data: invoicePdfData() })
    );

    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(2_000);
    expect(buffer.includes(Buffer.from("%%EOF"))).toBe(true);
  });

  it("rend aussi un avoir sans société ni paiement", async () => {
    const buffer = await renderToBuffer(
      React.createElement(InvoicePdf, {
        data: invoicePdfData({
          invoiceNumber: "AV-2026-0001",
          invoiceType: "AVOIR",
          totalHT: -100,
          totalVAT: -20,
          totalTTC: -120,
          previousBalance: 0,
          isAvoir: true,
          society: null,
          payments: [],
          creditNoteForNumber: "FAC-2026-0001",
        }),
      })
    );

    expect(buffer.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1_500);
  });
});
