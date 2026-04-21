import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const pdfCtx = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(Buffer.from("pdf-buffer")),
  np: vi.fn(() => ({ id: "page-landscape-1" })),
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
  pdfCur: vi.fn((amount: number) => `${amount.toFixed(2)} EUR`),
  contentStartY: vi.fn(() => 500),
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
}));

import { generateSuiviMensuel } from "./suivi-mensuel";

describe("generateSuiviMensuel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helperMocks.initPdf.mockResolvedValue(pdfCtx);
    pdfCtx.save.mockResolvedValue(Buffer.from("pdf-buffer"));
    pdfCtx.np.mockReturnValue({ id: "page-landscape-1" });
  });

  it("génère un PDF même sans immeuble", async () => {
    prismaMock.building.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);

    const result = await generateSuiviMensuel({
      societyId: "society-1",
      type: "SUIVI_MENSUEL",
      year: 2026,
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toBe("suivi-mensuel-2026.pdf");
    expect(pdfCtx.np).not.toHaveBeenCalled();
    expect(helperMocks.drawCoverPage).toHaveBeenCalledWith(
      pdfCtx,
      "Tableau de Suivi Mensuel",
      "Exercice 2026",
      expect.arrayContaining(["Société : Ma Société", "Période : 01/01/2026 au 31/12/2026"])
    );
  });

  it("calcule les facturations, encaissements, charges, recouvrement et résultat net par mois", async () => {
    prismaMock.building.findMany.mockResolvedValue([
      { id: "building-1", name: "Immeuble A" },
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        issueDate: new Date("2026-01-15T00:00:00.000Z"),
        totalTTC: 1000,
        status: "PAYE",
        payments: [],
        lease: { lot: { buildingId: "building-1" } },
      },
      {
        issueDate: new Date("2026-02-15T00:00:00.000Z"),
        totalTTC: 800,
        status: "EN_ATTENTE",
        payments: [{ amount: 300 }],
        lease: { lot: { buildingId: "building-1" } },
      },
      {
        issueDate: new Date("2026-03-15T00:00:00.000Z"),
        totalTTC: 400,
        status: "PAYE",
        payments: [],
        lease: { lot: { buildingId: "other-building" } },
      },
    ] as never);
    prismaMock.charge.findMany.mockResolvedValue([
      { date: new Date("2026-01-20T00:00:00.000Z"), amount: 200, buildingId: "building-1" },
      { date: new Date("2026-02-20T00:00:00.000Z"), amount: 100, buildingId: "building-1" },
      { date: new Date("2026-03-20T00:00:00.000Z"), amount: 50, buildingId: "other-building" },
    ] as never);

    const result = await generateSuiviMensuel({
      societyId: "society-1",
      type: "SUIVI_MENSUEL",
      year: 2026,
    });

    expect(result.contentType).toBe("application/pdf");
    expect(pdfCtx.np).toHaveBeenCalledWith(true);
    expect(helperMocks.drawSectionHeader).toHaveBeenCalledWith(
      { id: "page-landscape-1" },
      pdfCtx.serifBold,
      500,
      "Immeuble A",
      841.89
    );
    expect(helperMocks.drawTableRow).toHaveBeenNthCalledWith(
      1,
      { id: "page-landscape-1" },
      pdfCtx.reg,
      expect.any(Number),
      [
        "Loyers facturés",
        "1000.00 EUR",
        "800.00 EUR",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "1800.00 EUR",
      ],
      expect.any(Array),
      expect.any(Array),
      { rowIndex: 0 },
      841.89
    );
    expect(helperMocks.drawTableRow).toHaveBeenNthCalledWith(
      2,
      { id: "page-landscape-1" },
      pdfCtx.reg,
      expect.any(Number),
      [
        "Loyers encaissés",
        "1000.00 EUR",
        "300.00 EUR",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "1300.00 EUR",
      ],
      expect.any(Array),
      expect.any(Array),
      { rowIndex: 1 },
      841.89
    );
    expect(helperMocks.drawTableRow).toHaveBeenNthCalledWith(
      4,
      { id: "page-landscape-1" },
      pdfCtx.reg,
      expect.any(Number),
      [
        "Taux recouvrement",
        "100.0%",
        "37.5%",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "72.2%",
      ],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 3 }),
      841.89
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      { id: "page-landscape-1" },
      pdfCtx.bold,
      expect.any(Number),
      [
        "Résultat net",
        "800.00 EUR",
        "200.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "0.00 EUR",
        "1000.00 EUR",
      ],
      expect.any(Array),
      expect.any(Array),
      841.89
    );
  });
});
