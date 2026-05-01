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
  drawMoyennesRow: vi.fn((_, __, y) => y - 16),
  drawSubText: vi.fn((_, __, y) => y - 12),
  drawEmptyMessage: vi.fn(),
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
  drawMoyennesRow: helperMocks.drawMoyennesRow,
  drawSubText: helperMocks.drawSubText,
  drawEmptyMessage: helperMocks.drawEmptyMessage,
}));

vi.mock("@/lib/utils", () => ({
  formatDate: vi.fn(() => "01/01/2026"),
}));

import { generateSituationLocative } from "./situation-locative";

describe("generateSituationLocative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helperMocks.initPdf.mockResolvedValue(pdfCtx);
    pdfCtx.save.mockResolvedValue(Buffer.from("pdf-buffer"));
    pdfCtx.np.mockReturnValue({ id: "page-1" });
  });

  it("génère un PDF avec message vide si aucun immeuble n'est trouvé", async () => {
    prismaMock.building.findMany.mockResolvedValue([] as never);

    const result = await generateSituationLocative({
      societyId: "society-1",
      type: "SITUATION_LOCATIVE",
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toMatch(/^situation-locative-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(helperMocks.drawEmptyMessage).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      700,
      "Aucun immeuble trouvé pour cette société."
    );
  });

  it("annualise les loyers et calcule les totaux/moyennes par immeuble", async () => {
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [
          {
            number: "A1",
            lotType: "BUREAUX",
            floor: "1",
            area: 50,
            marketRentValue: 1100,
            leases: [
              {
                startDate: new Date("2026-01-01T00:00:00.000Z"),
                paymentFrequency: "TRIMESTRIEL",
                currentRentHT: 3000,
                baseRentHT: 2400,
                tenant: {
                  entityType: "PERSONNE_PHYSIQUE",
                  firstName: "Alice",
                  lastName: "Durand",
                  companyName: null,
                },
                chargeProvisions: [
                  { monthlyAmount: 40 },
                  { monthlyAmount: 20 },
                ],
              },
            ],
          },
          {
            number: "A2",
            lotType: "STOCKAGE",
            floor: "0",
            area: 30,
            marketRentValue: 500,
            leases: [],
          },
        ],
      },
    ] as never);

    const result = await generateSituationLocative({
      societyId: "society-1",
      type: "SITUATION_LOCATIVE",
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/pdf");
    expect(prismaMock.building.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        lots: expect.objectContaining({
          include: expect.objectContaining({
            leases: expect.objectContaining({
              where: expect.objectContaining({
                deletedAt: null,
                status: { in: ["EN_COURS", "RENOUVELE"] },
                startDate: { lte: expect.any(Date) },
                endDate: { gte: expect.any(Date) },
              }),
            }),
          }),
        }),
      }),
    }));
    expect(helperMocks.drawSubText).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      "Occupation : 1/2 | Loyers annuels HC : 12000.00 EUR"
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      [
        "1",
        "A1",
        "BUREAUX",
        "50",
        "Alice Durand",
        "01/01/2026",
        "12000.00 EUR",
        "25.0%",
        "20.00 EUR",
        "1100.00 EUR",
        "60.00 EUR",
      ],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      [
        "TOTAUX",
        "",
        "",
        "80",
        "",
        "",
        "12000.00 EUR",
        "",
        "",
        "1600.00 EUR",
        "60.00 EUR",
      ],
      expect.any(Array),
      expect.any(Array)
    );
    expect(helperMocks.drawMoyennesRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      [
        "MOYENNES",
        "",
        "",
        "",
        "",
        "",
        "12000.00 EUR",
        "25.0%",
        "20.00 EUR",
        "",
        "",
      ],
      expect.any(Array),
      expect.any(Array)
    );
  });

  it("couvre ANNUEL, SEMESTRIEL et les sauts de page (lignes 21, 22, 75, 101-103, 149)", async () => {
    helperMocks.contentStartY.mockReturnValue(150);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [
          {
            number: "A1",
            lotType: "BUREAUX",
            floor: "1",
            area: 50,
            marketRentValue: 0,
            leases: [{
              startDate: new Date("2026-01-01"),
              paymentFrequency: "ANNUEL",
              currentRentHT: 5000,
              tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Alice", lastName: "Durand", companyName: null },
              chargeProvisions: [],
            }],
          },
          {
            number: "A2",
            lotType: "STOCKAGE",
            floor: "0",
            area: 40,
            marketRentValue: 0,
            leases: [{
              startDate: new Date("2026-01-01"),
              paymentFrequency: "SEMESTRIEL",
              currentRentHT: 2500,
              tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Bob", lastName: "Martin", companyName: null },
              chargeProvisions: [],
            }],
          },
        ],
      },
    ] as never);

    const result = await generateSituationLocative({
      societyId: "society-1",
      type: "SITUATION_LOCATIVE",
    });

    helperMocks.contentStartY.mockReturnValue(700);
    expect(result.contentType).toBe("application/pdf");
    expect(pdfCtx.np).toHaveBeenCalledTimes(4); // initial + 3 page breaks
  });

  it("filtre par buildingId (lignes 37, 63), gère PERSONNE_MORALE (lignes 108-110) et immeuble sans lots (ligne 158)", async () => {
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-empty",
        name: "Immeuble Vide",
        lots: [],
      },
      {
        id: "building-2",
        name: "Immeuble B",
        lots: [
          {
            number: "B1",
            lotType: "BUREAUX",
            floor: "1",
            area: 50,
            marketRentValue: 0,
            leases: [{
              startDate: new Date("2026-01-01"),
              paymentFrequency: "MENSUEL",
              currentRentHT: 1000,
              baseRentHT: 1000,
              tenant: {
                entityType: "PERSONNE_MORALE",
                companyName: "ACME SAS",
                firstName: null,
                lastName: null,
              },
              chargeProvisions: [],
            }],
          },
        ],
      },
    ] as never);

    const result = await generateSituationLocative({
      societyId: "society-1",
      type: "SITUATION_LOCATIVE",
      buildingId: "building-2",
    });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawCoverPage).toHaveBeenCalledWith(
      pdfCtx, "Situation Locative", "État des lots et baux actifs",
      expect.arrayContaining(["Immeuble filtré"])
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.reg, expect.any(Number),
      expect.arrayContaining(["ACME SAS"]),
      expect.any(Array), expect.any(Array), expect.anything()
    );
  });

  it("couvre MENSUEL (ligne 27), area nulle (ligne 137) et les moyennes vides (lignes 151, 158, 160)", async () => {
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [
          {
            number: "A1",
            lotType: "BUREAUX",
            floor: null,
            area: null,
            marketRentValue: null,
            leases: [{
              startDate: new Date("2026-01-01"),
              paymentFrequency: "MENSUEL",
              currentRentHT: 1000,
              baseRentHT: 1000,
              tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Alice", lastName: "Durand", companyName: null },
              chargeProvisions: [],
            }],
          },
        ],
      },
    ] as never);

    const result = await generateSituationLocative({
      societyId: "society-1",
      type: "SITUATION_LOCATIVE",
    });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.reg, expect.any(Number),
      expect.arrayContaining(["-"]),
      expect.any(Array), expect.any(Array), expect.objectContaining({ rowIndex: 0 })
    );
    expect(helperMocks.drawMoyennesRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.bold, expect.any(Number),
      expect.arrayContaining(["-"]),
      expect.any(Array), expect.any(Array)
    );
  });

  it("couvre PERSONNE_MORALE companyName null (ligne 109) et PERSONNE_PHYSIQUE sans nom (ligne 110)", async () => {
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [
          {
            number: "A1",
            lotType: "BUREAUX",
            floor: "1",
            area: 40,
            marketRentValue: 0,
            leases: [{
              startDate: new Date("2026-01-01"),
              paymentFrequency: "MENSUEL",
              currentRentHT: 900,
              baseRentHT: 900,
              tenant: { entityType: "PERSONNE_MORALE", companyName: null, firstName: null, lastName: null },
              chargeProvisions: [],
            }],
          },
          {
            number: "A2",
            lotType: "BUREAUX",
            floor: "2",
            area: 30,
            marketRentValue: 0,
            leases: [{
              startDate: new Date("2026-01-01"),
              paymentFrequency: "MENSUEL",
              currentRentHT: 700,
              baseRentHT: 700,
              tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: null, lastName: null, companyName: null },
              chargeProvisions: [],
            }],
          },
        ],
      },
    ] as never);

    const result = await generateSituationLocative({
      societyId: "society-1",
      type: "SITUATION_LOCATIVE",
    });
    expect(result.contentType).toBe("application/pdf");
    // Les deux locataires doivent afficher "-" comme nom
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.reg, expect.any(Number),
      expect.arrayContaining(["-"]),
      expect.any(Array), expect.any(Array), expect.objectContaining({ rowIndex: 0 })
    );
  });
});
