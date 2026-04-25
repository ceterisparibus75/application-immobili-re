import { describe, it, expect, vi, beforeEach } from "vitest";

const mockToXML = vi.hoisted(() => vi.fn().mockResolvedValue("<rsm:CrossIndustryInvoice></rsm:CrossIndustryInvoice>"));
const mockEmbedInPdf = vi.hoisted(() => vi.fn().mockResolvedValue(new Uint8Array([80, 68, 70])));
const mockCreate = vi.hoisted(() =>
  vi.fn().mockReturnValue({ toXML: mockToXML, embedInPdf: mockEmbedInPdf })
);

vi.mock("node-zugferd", () => ({
  zugferd: () => ({ create: mockCreate }),
}));
vi.mock("node-zugferd/profile/basic", () => ({ BASIC: {} }));

import { generateFacturXml, generateFacturX } from "./einvoice-generator";
import type { InvoicePdfData } from "./invoice-pdf";

beforeEach(() => {
  vi.clearAllMocks();
});

const MINIMAL_DATA: InvoicePdfData = {
  invoiceNumber: "FAC-2025-001",
  invoiceType: "APPEL_LOYER",
  issueDate: "2025-01-31",
  dueDate: "2025-02-05",
  totalHT: 800,
  totalVAT: 0,
  totalTTC: 800,
  previousBalance: 0,
  isAvoir: false,
  society: {
    name: "SCI Les Pins",
    siret: "12345678901234",
    email: "gestion@scilespins.fr",
    addressLine1: "12 rue de la Paix",
    postalCode: "75001",
    city: "Paris",
    country: "FR",
  },
  tenant: { name: "Jean Dupont", email: "jean@example.com" },
  lotLabel: "Lot 3 - Résidence Les Pins",
  lines: [{ label: "Loyer janvier 2025", totalHT: 800, vatRate: 0, totalTTC: 800 }],
  payments: [],
};

describe("generateFacturXml", () => {
  it("retourne une chaîne XML non vide", async () => {
    const xml = await generateFacturXml(MINIMAL_DATA);
    expect(typeof xml).toBe("string");
    expect(xml.length).toBeGreaterThan(0);
  });

  it("appelle invoicer.create avec un schéma", async () => {
    await generateFacturXml(MINIMAL_DATA);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockToXML).toHaveBeenCalledOnce();
  });

  it("utilise le code type 381 pour un avoir", async () => {
    mockCreate.mockClear();
    await generateFacturXml({ ...MINIMAL_DATA, isAvoir: true });
    const schema = mockCreate.mock.calls[0][0] as { typeCode: string };
    expect(schema.typeCode).toBe("381");
  });

  it("utilise le code type 380 pour une facture normale", async () => {
    mockCreate.mockClear();
    await generateFacturXml({ ...MINIMAL_DATA, isAvoir: false });
    const schema = mockCreate.mock.calls[0][0] as { typeCode: string };
    expect(schema.typeCode).toBe("380");
  });

  it("inclut le numéro de facture dans le schéma", async () => {
    mockCreate.mockClear();
    await generateFacturXml(MINIMAL_DATA);
    const schema = mockCreate.mock.calls[0][0] as { number: string };
    expect(schema.number).toBe("FAC-2025-001");
  });
});

  it("regroupe les lignes avec le même taux de TVA (lignes 210-211)", async () => {
    mockCreate.mockClear();
    const xml = await generateFacturXml({
      ...MINIMAL_DATA,
      lines: [
        { label: "Loyer jan", totalHT: 800, vatRate: 20, totalTTC: 960 },
        { label: "Charges jan", totalHT: 200, vatRate: 20, totalTTC: 240 },
      ],
    });
    // Two lines with the same VAT rate → merged into one vatBreakdown entry
    expect(xml).toBeTruthy();
    const schema = mockCreate.mock.calls[0][0] as {
      transaction: { tradeSettlement: { vatBreakdown: Array<{ rateApplicablePercent: number; basisAmount: number }> } };
    };
    const vat20 = schema.transaction.tradeSettlement.vatBreakdown.find((v) => v.rateApplicablePercent === 20);
    expect(vat20?.basisAmount).toBe(1000);
  });

describe("generateFacturX", () => {
  const PDF_BUFFER = Buffer.from("fake-pdf-bytes");

  it("retourne un Buffer", async () => {
    const result = await generateFacturX(PDF_BUFFER, MINIMAL_DATA);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("appelle embedInPdf avec le buffer PDF fourni", async () => {
    mockEmbedInPdf.mockClear();
    await generateFacturX(PDF_BUFFER, MINIMAL_DATA);
    expect(mockEmbedInPdf).toHaveBeenCalledOnce();
    const [buf] = mockEmbedInPdf.mock.calls[0] as [Buffer, unknown];
    expect(buf).toEqual(PDF_BUFFER);
  });

  it("inclut le numéro de facture dans les métadonnées", async () => {
    mockEmbedInPdf.mockClear();
    await generateFacturX(PDF_BUFFER, MINIMAL_DATA);
    const [, meta] = mockEmbedInPdf.mock.calls[0] as [unknown, { metadata: { title: string } }];
    expect(meta.metadata.title).toContain("FAC-2025-001");
  });
});
