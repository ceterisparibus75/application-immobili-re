import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const pdfCtx = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(Buffer.from("pdf-buffer")),
  np: vi.fn(() => ({ id: "page-1" })),
  reg: {},
  bold: {},
  serifBold: {},
}));

const helperMocks = vi.hoisted(() => ({
  initPdf: vi.fn().mockResolvedValue(pdfCtx),
  drawCoverPage: vi.fn(),
  drawSectionHeader: vi.fn((_, __, y) => y - 20),
  drawTableHeader: vi.fn((_, __, y) => y - 20),
  drawTableRow: vi.fn((_, __, y) => y - 16),
  drawTotalsRow: vi.fn((_, __, y) => y - 16),
  drawKpiRow: vi.fn((_, __, ___, y) => y - 14),
  drawPieChart: vi.fn((_, __, y) => y - 120),
  pdfCur: vi.fn((amount: number) => `${amount.toFixed(2)} EUR`),
  contentStartY: vi.fn(() => 700),
  minY: vi.fn(() => 100),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../pdf-core", () => ({
  initPdf: helperMocks.initPdf,
  drawCoverPage: helperMocks.drawCoverPage,
  pdfCur: helperMocks.pdfCur,
  contentStartY: helperMocks.contentStartY,
  minY: helperMocks.minY,
}));

vi.mock("../pdf-helpers", () => ({
  drawSectionHeader: helperMocks.drawSectionHeader,
  drawTableHeader: helperMocks.drawTableHeader,
  drawTableRow: helperMocks.drawTableRow,
  drawTotalsRow: helperMocks.drawTotalsRow,
  drawKpiRow: helperMocks.drawKpiRow,
}));

vi.mock("../pdf-charts", () => ({
  drawPieChart: helperMocks.drawPieChart,
}));

import { generateBalanceAgee } from "./balance-agee";

describe("generateBalanceAgee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helperMocks.initPdf.mockResolvedValue(pdfCtx);
    pdfCtx.save.mockResolvedValue(Buffer.from("pdf-buffer"));
    pdfCtx.np.mockReturnValue({ id: "page-1" });
  });

  it("génère un PDF même sans facture impayée", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([] as never);

    const result = await generateBalanceAgee({
      societyId: "society-1",
      type: "BALANCE_AGEE",
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toMatch(/^balance-agee-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Nombre de factures impayées",
      "0"
    );
    expect(helperMocks.drawPieChart).toHaveBeenCalled();
  });

  it("agrège les créances par immeuble et par tranche d'ancienneté", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        totalTTC: 1200,
        dueDate: new Date(today.getTime() - 20 * 86400000),
        tenant: {
          entityType: "PERSONNE_PHYSIQUE",
          firstName: "Alice",
          lastName: "Durand",
          companyName: null,
        },
        lease: {
          lot: {
            number: "A1",
            building: { name: "Immeuble A" },
          },
        },
      },
      {
        totalTTC: 800,
        dueDate: new Date(today.getTime() - 75 * 86400000),
        tenant: {
          entityType: "PERSONNE_PHYSIQUE",
          firstName: "Alice",
          lastName: "Durand",
          companyName: null,
        },
        lease: {
          lot: {
            number: "A1",
            building: { name: "Immeuble A" },
          },
        },
      },
      {
        totalTTC: 500,
        dueDate: new Date(today.getTime() - 130 * 86400000),
        tenant: {
          entityType: "PERSONNE_MORALE",
          companyName: "ACME SAS",
          firstName: null,
          lastName: null,
        },
        lease: {
          lot: {
            number: "B2",
            building: { name: "Immeuble B" },
          },
        },
      },
    ] as never);

    const result = await generateBalanceAgee({
      societyId: "society-1",
      type: "BALANCE_AGEE",
    });

    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      [
        "TOTAL GÉNÉRAL",
        "",
        "500.00 EUR",
        "-",
        "800.00 EUR",
        "-",
        "1200.00 EUR",
        "2500.00 EUR",
      ],
      expect.any(Array),
      expect.any(Array)
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalled();
  });
});
