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
  drawBarChart: vi.fn((_, __, y) => y - 140),
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
  drawBarChart: helperMocks.drawBarChart,
}));

import { generateVacanceLocative } from "./vacance-locative";

describe("generateVacanceLocative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helperMocks.initPdf.mockResolvedValue(pdfCtx);
    pdfCtx.save.mockResolvedValue(Buffer.from("pdf-buffer"));
    pdfCtx.np.mockReturnValue({ id: "page-1" });
  });

  it("génère un PDF avec des KPI à zéro quand aucun immeuble n'est trouvé", async () => {
    prismaMock.building.findMany.mockResolvedValue([] as never);

    const result = await generateVacanceLocative({
      societyId: "society-1",
      type: "VACANCE_LOCATIVE",
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toMatch(/^vacance-locative-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Total lots",
      "0"
    );
    expect(helperMocks.drawPieChart).toHaveBeenCalled();
    expect(helperMocks.drawBarChart).not.toHaveBeenCalled();
  });

  it("calcule la vacance globale, les surfaces et le détail par immeuble", async () => {
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [
          { area: 50, leases: [{ id: "lease-1" }] },
          { area: 30, leases: [] },
        ],
      },
      {
        id: "building-2",
        name: "Immeuble B",
        lots: [
          { area: 20, leases: [] },
        ],
      },
    ] as never);

    const result = await generateVacanceLocative({
      societyId: "society-1",
      type: "VACANCE_LOCATIVE",
    });

    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Taux de vacance",
      "66.7%",
      expect.anything()
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      ["TOTAL", "3", "1", "2", "66.7%", "100 m2", "50 m2"],
      expect.any(Array),
      expect.any(Array)
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      ["Immeuble A", "2", "1", "1", "50.0%", "80 m2", "30 m2"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
    expect(helperMocks.drawBarChart).toHaveBeenCalled();
  });

  it("gère les sauts de page (lignes 94, 114-116, 143)", async () => {
    helperMocks.contentStartY.mockReturnValue(150);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [{ area: 50, leases: [{ id: "lease-1" }] }],
      },
      {
        id: "building-2",
        name: "Immeuble B",
        lots: [{ area: 30, leases: [] }],
      },
      {
        id: "building-3",
        name: "Immeuble C",
        lots: [{ area: 20, leases: [] }],
      },
    ] as never);

    const result = await generateVacanceLocative({
      societyId: "society-1",
      type: "VACANCE_LOCATIVE",
    });

    helperMocks.contentStartY.mockReturnValue(700);
    expect(result.contentType).toBe("application/pdf");
    expect(pdfCtx.np).toHaveBeenCalledTimes(5); // initial + line 94 + line 105 + lines 114-116 + line 143
  });

  it("filtre par buildingId (ligne 18), gère l'area nulle (lignes 47-48, 124) et un immeuble sans lots (ligne 60)", async () => {
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [
          { area: null, leases: [{ id: "lease-1" }] },
          { area: null, leases: [] },
        ],
      },
      {
        id: "building-2",
        name: "Immeuble B",
        lots: [],
      },
    ] as never);

    const result = await generateVacanceLocative({
      societyId: "society-1",
      type: "VACANCE_LOCATIVE",
      buildingId: "building-1",
    });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.bold, expect.any(Number),
      ["TOTAL", "2", "1", "1", "50.0%", "-", "-"],
      expect.any(Array), expect.any(Array)
    );
  });

  it("affiche GREEN pour surface vacante nulle (ligne 79 — vacSurface = 0)", async () => {
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [
          { area: 50, leases: [{ id: "lease-1" }] },
          { area: 30, leases: [{ id: "lease-2" }] },
        ],
      },
    ] as never);

    const result = await generateVacanceLocative({
      societyId: "society-1",
      type: "VACANCE_LOCATIVE",
    });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.bold, pdfCtx.reg, expect.any(Number),
      "Surface vacante", "0 m2", expect.anything()
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.bold, expect.any(Number),
      ["TOTAL", "2", "2", "0", "0.0%", "80 m2", "-"],
      expect.any(Array), expect.any(Array)
    );
  });
});
