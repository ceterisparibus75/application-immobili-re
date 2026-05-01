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

  it("classe les créances à 100 jours dans la tranche 91-120j (ligne 19)", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        totalTTC: 700,
        dueDate: new Date(today.getTime() - 100 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Martin", companyName: null },
        lease: { lot: { number: "A1", building: { name: "Immeuble C" } } },
      },
    ] as never);

    const result = await generateBalanceAgee({ societyId: "society-1", type: "BALANCE_AGEE" });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      expect.anything(),
      pdfCtx.bold,
      expect.any(Number),
      ["TOTAL GÉNÉRAL", "", "-", "700.00 EUR", "-", "-", "-", "700.00 EUR"],
      expect.any(Array),
      expect.any(Array),
    );
  });

  it("classe les créances à 45 jours dans la tranche 31-60j (ligne 21)", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        totalTTC: 500,
        dueDate: new Date(today.getTime() - 45 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Marie", lastName: "Dupont", companyName: null },
        lease: { lot: { number: "B1", building: { name: "Immeuble D" } } },
      },
    ] as never);

    const result = await generateBalanceAgee({ societyId: "society-1", type: "BALANCE_AGEE" });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      expect.anything(),
      pdfCtx.bold,
      expect.any(Number),
      ["TOTAL GÉNÉRAL", "", "-", "-", "-", "500.00 EUR", "-", "500.00 EUR"],
      expect.any(Array),
      expect.any(Array),
    );
  });

  it("affiche 'Autre' si building.name absent et '-' si lot null (lignes 83, 91)", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        totalTTC: 600,
        dueDate: new Date(today.getTime() - 10 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Paul", lastName: "Vidal", companyName: null },
        lease: { lot: null },
      },
    ] as never);

    const result = await generateBalanceAgee({ societyId: "society-1", type: "BALANCE_AGEE" });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.reg, expect.any(Number),
      expect.arrayContaining(["Paul Vidal", "-"]),
      expect.any(Array), expect.any(Array), expect.objectContaining({ rowIndex: 0 })
    );
  });

  it("rattache une facture sans bail à son immeuble explicite", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        totalTTC: 600,
        dueDate: new Date(today.getTime() - 10 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Paul", lastName: "Vidal", companyName: null },
        building: { name: "Immeuble Direct" },
        lease: null,
      },
    ] as never);

    const result = await generateBalanceAgee({ societyId: "society-1", type: "BALANCE_AGEE" });

    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawSectionHeader).toHaveBeenCalledWith(
      expect.anything(),
      pdfCtx.serifBold,
      expect.any(Number),
      "Immeuble Direct"
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(),
      pdfCtx.reg,
      expect.any(Number),
      expect.arrayContaining(["Paul Vidal", "Immeuble Direct"]),
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
  });

  it("ne fusionne pas deux locataires homonymes dans le même immeuble", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        totalTTC: 600,
        dueDate: new Date(today.getTime() - 10 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Alex", lastName: "Martin", companyName: null },
        lease: { lot: { number: "A1", building: { name: "Immeuble A" } } },
      },
      {
        tenantId: "tenant-2",
        totalTTC: 300,
        dueDate: new Date(today.getTime() - 10 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Alex", lastName: "Martin", companyName: null },
        lease: { lot: { number: "A2", building: { name: "Immeuble A" } } },
      },
    ] as never);

    const result = await generateBalanceAgee({ societyId: "society-1", type: "BALANCE_AGEE" });

    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(),
      pdfCtx.reg,
      expect.any(Number),
      expect.arrayContaining(["Alex Martin", "Immeuble A/A1", "600.00 EUR"]),
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(),
      pdfCtx.reg,
      expect.any(Number),
      expect.arrayContaining(["Alex Martin", "Immeuble A/A2", "300.00 EUR"]),
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 1 })
    );
  });

  it("affiche '-' pour PERSONNE_MORALE avec companyName null (ligne 87) et nom vide (ligne 88)", async () => {
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        totalTTC: 400,
        dueDate: new Date(today.getTime() - 10 * 86400000),
        tenant: { entityType: "PERSONNE_MORALE", companyName: null, firstName: null, lastName: null },
        lease: { lot: { number: "C1", building: { name: "Immeuble C" } } },
      },
      {
        totalTTC: 300,
        dueDate: new Date(today.getTime() - 10 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: null, lastName: null },
        lease: { lot: { number: "C2", building: { name: "Immeuble C" } } },
      },
    ] as never);

    const result = await generateBalanceAgee({ societyId: "society-1", type: "BALANCE_AGEE" });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.reg, expect.any(Number),
      expect.arrayContaining(["-"]),
      expect.any(Array), expect.any(Array), expect.objectContaining({ rowIndex: 0 })
    );
  });

  it("gère les sauts de page quand y < seuil (lignes 100, 107, 124)", async () => {
    helperMocks.contentStartY.mockReturnValue(150);
    const today = new Date();
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        totalTTC: 1200,
        dueDate: new Date(today.getTime() - 20 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Alice", lastName: "Durand", companyName: null },
        lease: { lot: { number: "A1", building: { name: "Immeuble X" } } },
      },
      {
        totalTTC: 800,
        dueDate: new Date(today.getTime() - 45 * 86400000),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Bob", lastName: "Martin", companyName: null },
        lease: { lot: { number: "A2", building: { name: "Immeuble X" } } },
      },
    ] as never);

    const result = await generateBalanceAgee({ societyId: "society-1", type: "BALANCE_AGEE" });
    helperMocks.contentStartY.mockReturnValue(700); // restore
    expect(result.contentType).toBe("application/pdf");
    expect(pdfCtx.np).toHaveBeenCalledTimes(4); // initial + 3 page breaks
  });
});
