import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const excelMocks = vi.hoisted(() => {
  const cell = () => ({
    value: undefined as unknown,
    font: undefined as unknown,
    alignment: undefined as unknown,
    fill: undefined as unknown,
    numFmt: undefined as unknown,
  });

  const worksheet = {
    mergeCells: vi.fn(),
    getCell: vi.fn(() => cell()),
    getRow: vi.fn(() => ({
      height: undefined as unknown,
      eachCell: vi.fn(),
      getCell: vi.fn(() => cell()),
    })),
    getColumn: vi.fn(() => ({ width: undefined as unknown })),
    addRow: vi.fn((values: unknown[]) => ({
      values,
      eachCell: vi.fn((cb?: (c: ReturnType<typeof cell>) => void) => {
        if (cb) values.forEach(() => cb(cell()));
      }),
      getCell: vi.fn(() => cell()),
    })),
  };

  const addWorksheet = vi.fn(() => worksheet);
  const writeBuffer = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  const Workbook = vi.fn(class WorkbookMock {
    creator = "";
    created: Date | undefined;
    addWorksheet = addWorksheet;
    xlsx = { writeBuffer };
  });

  return { Workbook, addWorksheet, writeBuffer, worksheet };
});

vi.mock("exceljs", () => ({ default: { Workbook: excelMocks.Workbook } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { generateSuiviTravaux } from "./suivi-travaux";

const SOCIETY_ID = "society-1";

function makeMaintenance(overrides: Record<string, unknown> = {}) {
  return {
    id: "maint-1",
    title: "Remplacement chaudière",
    description: "Chaudière HS depuis 2 semaines",
    cost: 1500,
    isPaid: true,
    scheduledAt: new Date("2025-03-10"),
    completedAt: new Date("2025-03-15"),
    createdAt: new Date("2025-03-01"),
    building: { name: "Immeuble A" },
    ...overrides,
  };
}

describe("generateSuiviTravaux", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    excelMocks.writeBuffer.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  });

  it("génère un xlsx vide si aucune maintenance n'est trouvée", async () => {
    prismaMock.maintenance.findMany.mockResolvedValue([] as never);

    const result = await generateSuiviTravaux({
      societyId: SOCIETY_ID,
      type: "SUIVI_TRAVAUX",
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.filename).toMatch(/^suivi-travaux-\d{4}\.xlsx$/);
    expect(excelMocks.Workbook).toHaveBeenCalled();
    expect(excelMocks.addWorksheet).toHaveBeenCalledWith("Suivi travaux");
    expect(excelMocks.addWorksheet).toHaveBeenCalledWith("Synthèse par immeuble");
    expect(excelMocks.writeBuffer).toHaveBeenCalled();
    // Row TOTAL doit être ajouté même si aucune maintenance
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith(
      expect.arrayContaining(["TOTAL"])
    );
  });

  it("inclut le nom de société dans le titre si fourni", async () => {
    prismaMock.maintenance.findMany.mockResolvedValue([] as never);

    await generateSuiviTravaux({
      societyId: SOCIETY_ID,
      type: "SUIVI_TRAVAUX",
      society: { name: "SCI Dupont" },
    });

    expect(excelMocks.worksheet.getCell).toHaveBeenCalledWith("A1");
  });

  it("génère le titre sans nom de société si non fourni", async () => {
    prismaMock.maintenance.findMany.mockResolvedValue([] as never);

    const result = await generateSuiviTravaux({
      societyId: SOCIETY_ID,
      type: "SUIVI_TRAVAUX",
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("ajoute une ligne par maintenance et calcule le total", async () => {
    prismaMock.maintenance.findMany.mockResolvedValue([
      makeMaintenance({ cost: 1500 }),
      makeMaintenance({
        id: "maint-2",
        title: "Peinture cage d'escalier",
        description: null,
        cost: 800,
        isPaid: false,
        scheduledAt: null,
        completedAt: null,
        building: { name: "Immeuble B" },
      }),
    ] as never);

    const result = await generateSuiviTravaux({
      societyId: SOCIETY_ID,
      type: "SUIVI_TRAVAUX",
      year: 2025,
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.filename).toBe("suivi-travaux-2025.xlsx");
    // 2 lignes maintenance + 1 en-tête + 1 TOTAL = au moins 3 appels addRow
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith(
      expect.arrayContaining(["TOTAL", "", "", 2300, "", "", ""])
    );
  });

  it("filtre par buildingId si fourni", async () => {
    prismaMock.maintenance.findMany.mockResolvedValue([
      makeMaintenance({ cost: 600 }),
    ] as never);

    const result = await generateSuiviTravaux({
      societyId: SOCIETY_ID,
      type: "SUIVI_TRAVAUX",
      buildingId: "building-1",
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(prismaMock.maintenance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ buildingId: "building-1" }),
      })
    );
  });

  it("gère les maintenances avec cost null (compte comme 0)", async () => {
    prismaMock.maintenance.findMany.mockResolvedValue([
      makeMaintenance({ cost: null, isPaid: false }),
    ] as never);

    const result = await generateSuiviTravaux({
      societyId: SOCIETY_ID,
      type: "SUIVI_TRAVAUX",
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith(
      expect.arrayContaining(["TOTAL", "", "", 0, "", "", ""])
    );
  });

  it("ajoute la synthèse par immeuble avec totaux corrects", async () => {
    prismaMock.maintenance.findMany.mockResolvedValue([
      makeMaintenance({ cost: 1000, building: { name: "Immeuble A" } }),
      makeMaintenance({ id: "m2", cost: 500, building: { name: "Immeuble A" } }),
      makeMaintenance({ id: "m3", cost: 300, building: { name: "Immeuble B" } }),
    ] as never);

    const result = await generateSuiviTravaux({
      societyId: SOCIETY_ID,
      type: "SUIVI_TRAVAUX",
    });

    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    // La synthèse doit avoir une ligne par immeuble + TOTAL
    expect(excelMocks.addWorksheet).toHaveBeenCalledWith("Synthèse par immeuble");
    expect(excelMocks.worksheet.addRow).toHaveBeenCalledWith(
      expect.arrayContaining(["TOTAL", 1800, 3])
    );
  });
});
