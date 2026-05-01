import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const excelMocks = vi.hoisted(() => {
  const cell = () => ({ value: undefined, font: undefined, alignment: undefined, fill: undefined, numFmt: undefined, border: undefined });

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
      eachCell: vi.fn((callback?: (cellValue: ReturnType<typeof cell>, cellIndex: number) => void) => {
        if (callback) {
          values.forEach((_, index) => callback(cell(), index + 1));
        }
      }),
      getCell: vi.fn(() => cell()),
    })),
    addConditionalFormatting: vi.fn(),
  };

  const addWorksheet = vi.fn(() => worksheet);
  const writeBuffer = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  const Workbook = vi.fn(class WorkbookMock {
    creator = "";
    created: Date | undefined;
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

import { generateRentabiliteLot } from "./rentabilite-lot";

describe("generateRentabiliteLot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("génère un xlsx vide avec une ligne TOTAL à zéro", async () => {
    prismaMock.lot.findMany.mockResolvedValue([] as never);

    const result = await generateRentabiliteLot({
      societyId: "society-1",
      type: "RENTABILITE_LOT",
      year: 2026,
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.filename).toBe("rentabilite-lots-2026.xlsx");
    expect(excelMocks.Workbook).toHaveBeenCalled();
    expect(excelMocks.addWorksheet).toHaveBeenCalledWith("Rentabilité par lot");
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith(["TOTAL", "", "", "", "", 0, null, ""]);
    expect(excelMocks.worksheet.addConditionalFormatting).not.toHaveBeenCalled();
    expect(excelMocks.writeBuffer).toHaveBeenCalled();
  });

  it("agrège les revenus annuels par lot et applique le filtre buildingId", async () => {
    prismaMock.lot.findMany.mockResolvedValue([
      {
        building: { name: "Immeuble A" },
        number: "A1",
        lotType: "APPARTEMENT",
        status: "EN_LOCATION",
        marketRentValue: 950,
        leases: [
          {
            currentRentHT: 900,
            invoices: [
              { totalTTC: 1000 },
              { totalTTC: 1100 },
            ],
          },
        ],
      },
      {
        building: { name: "Immeuble A" },
        number: "A2",
        lotType: "BUREAUX",
        status: "VACANT",
        marketRentValue: 1200,
        leases: [],
      },
    ] as never);

    const result = await generateRentabiliteLot({
      societyId: "society-1",
      type: "RENTABILITE_LOT",
      year: 2026,
      buildingId: "building-1",
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(prismaMock.lot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        buildingId: "building-1",
      }),
      include: expect.objectContaining({
        leases: expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            status: { in: ["EN_COURS", "RENOUVELE", "RESILIE", "CONTENTIEUX"] },
            startDate: { lte: expect.any(Date) },
            endDate: { gte: expect.any(Date) },
          }),
          orderBy: { startDate: "desc" },
        }),
      }),
    }));
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith([
      "Immeuble A",
      "A1",
      "APPARTEMENT",
      "Occupé",
      900,
      2100,
      950,
      "EN LOCATION",
    ]);
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith([
      "TOTAL",
      "",
      "",
      "",
      "",
      2100,
      null,
      "",
    ]);
    expect(excelMocks.worksheet.addConditionalFormatting).toHaveBeenCalledWith(expect.objectContaining({
      ref: "D3:D4",
    }));
    expect(excelMocks.writeBuffer).toHaveBeenCalled();
  });

  it("utilise l'année courante si year absent (ligne 7) et gère marketRentValue null (ligne 63)", async () => {
    prismaMock.lot.findMany.mockResolvedValue([
      {
        building: { name: "Immeuble A" },
        number: "A1",
        lotType: "APPARTEMENT",
        status: "EN_LOCATION",
        marketRentValue: null,
        leases: [
          {
            currentRentHT: 900,
            invoices: [{ totalTTC: 1000 }],
          },
        ],
      },
    ] as never);

    const currentYear = new Date().getFullYear();
    const result = await generateRentabiliteLot({
      societyId: "society-1",
      type: "RENTABILITE_LOT",
    });

    expect(result.filename).toBe(`rentabilite-lots-${currentYear}.xlsx`);
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith(
      expect.arrayContaining(["A1", null, "EN LOCATION"])
    );
  });

  it("additionne les revenus de tous les baux successifs du lot sur l'exercice", async () => {
    prismaMock.lot.findMany.mockResolvedValue([
      {
        building: { name: "Immeuble A" },
        number: "A1",
        lotType: "APPARTEMENT",
        status: "EN_LOCATION",
        marketRentValue: 950,
        leases: [
          {
            currentRentHT: 980,
            invoices: [{ totalTTC: 980 }],
          },
          {
            currentRentHT: 900,
            invoices: [{ totalTTC: 900 }, { totalTTC: 920 }],
          },
        ],
      },
    ] as never);

    await generateRentabiliteLot({
      societyId: "society-1",
      type: "RENTABILITE_LOT",
      year: 2026,
    });

    expect(prismaMock.lot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        leases: expect.not.objectContaining({ take: 1 }),
      }),
    }));
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith([
      "Immeuble A",
      "A1",
      "APPARTEMENT",
      "Occupé",
      980,
      2800,
      950,
      "EN LOCATION",
    ]);
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith(["TOTAL", "", "", "", "", 2800, null, ""]);
  });
});
