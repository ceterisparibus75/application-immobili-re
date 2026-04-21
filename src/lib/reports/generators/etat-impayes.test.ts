import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const pageMock = vi.hoisted(() => ({
  id: "page-1",
  drawText: vi.fn(),
}));

const pdfCtx = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(Buffer.from("pdf-buffer")),
  np: vi.fn(() => pageMock),
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
  drawEmptyMessage: vi.fn(),
  drawPieChart: vi.fn((_, __, y) => y - 120),
  pdfCur: vi.fn((amount: number) => `${amount.toFixed(2)} EUR`),
  contentStartY: vi.fn(() => 700),
  minY: vi.fn(() => 100),
}));

const excelMocks = vi.hoisted(() => {
  const cell = () => ({ value: undefined, font: undefined, alignment: undefined, fill: undefined, numFmt: undefined });

  const worksheet = {
    mergeCells: vi.fn(),
    getCell: vi.fn(() => cell()),
    getRow: vi.fn(() => ({
      height: undefined,
      eachCell: vi.fn(),
      getCell: vi.fn(() => cell()),
    })),
    getColumn: vi.fn(() => ({ width: undefined })),
    addRow: vi.fn((values: unknown[]) => ({
      values,
      eachCell: vi.fn((callback?: (cellValue: ReturnType<typeof cell>) => void) => {
        if (callback) {
          values.forEach(() => callback(cell()));
        }
      }),
      getCell: vi.fn(() => cell()),
    })),
  };

  const addWorksheet = vi.fn(() => worksheet);
  const writeBuffer = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  const Workbook = vi.fn(class WorkbookMock {
    creator = "";
    addWorksheet = addWorksheet;
    xlsx = {
      writeBuffer,
    };
  });

  return { Workbook, addWorksheet, writeBuffer, worksheet };
});

vi.mock("exceljs", () => ({
  default: { Workbook: excelMocks.Workbook },
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
  drawEmptyMessage: helperMocks.drawEmptyMessage,
}));

vi.mock("../pdf-charts", () => ({
  drawPieChart: helperMocks.drawPieChart,
}));

import { generateEtatImpayes } from "./etat-impayes";

describe("generateEtatImpayes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helperMocks.initPdf.mockResolvedValue(pdfCtx);
    pdfCtx.save.mockResolvedValue(Buffer.from("pdf-buffer"));
    pdfCtx.np.mockReturnValue(pageMock);
    pageMock.drawText.mockReset();
  });

  it("génère un PDF vide si aucune facture impayée n'est trouvée", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([] as never);

    const result = await generateEtatImpayes({
      societyId: "society-1",
      type: "ETAT_IMPAYES",
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toMatch(/^impayes-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(pageMock.drawText).toHaveBeenCalledWith("Aucune facture impayée", expect.objectContaining({
      font: pdfCtx.bold,
    }));
    expect(helperMocks.drawPieChart).not.toHaveBeenCalled();
  });

  it("agrège les montants par tranche d'ancienneté et par locataire", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        invoiceNumber: "INV-001",
        dueDate: new Date(today.getTime() - 15 * 86400000),
        totalTTC: 1200,
        status: "VALIDE",
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
        tenantId: "tenant-1",
        invoiceNumber: "INV-002",
        dueDate: new Date(today.getTime() - 75 * 86400000),
        totalTTC: 800,
        status: "VALIDE",
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
        tenantId: "tenant-2",
        invoiceNumber: "INV-003",
        dueDate: new Date(today.getTime() - 140 * 86400000),
        totalTTC: 500,
        status: "RELANCE_3",
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

    const result = await generateEtatImpayes({
      societyId: "society-1",
      type: "ETAT_IMPAYES",
    });

    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawPieChart).toHaveBeenCalled();
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      pageMock,
      pdfCtx.reg,
      expect.any(Number),
      ["Alice Durand", "Immeuble A / A1", "1200.00 EUR", "-", "800.00 EUR", "-", "-", "2000.00 EUR"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      pageMock,
      pdfCtx.bold,
      expect.any(Number),
      ["TOTAL", "", "1200.00 EUR", "-", "800.00 EUR", "-", "500.00 EUR", "2500.00 EUR"],
      expect.any(Array),
      expect.any(Array)
    );
  });

  it("génère un export xlsx avec total et nom de fichier cohérents", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
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
        invoiceNumber: "INV-001",
        dueDate: new Date(today.getTime() - 20 * 86400000),
        totalTTC: 1200,
        status: "VALIDE",
      },
    ] as never);

    const result = await generateEtatImpayes({
      societyId: "society-1",
      type: "ETAT_IMPAYES",
      format: "xlsx",
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.filename).toMatch(/^impayes-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(excelMocks.Workbook).toHaveBeenCalled();
    expect(excelMocks.addWorksheet).toHaveBeenCalledWith("Impayés");
    expect(excelMocks.writeBuffer).toHaveBeenCalled();
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith(expect.arrayContaining(["TOTAL", "", "", "", 1200, "", "", ""]));
  });
});
