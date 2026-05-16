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
  drawKpiRow: helperMocks.drawKpiRow,
  drawEmptyMessage: helperMocks.drawEmptyMessage,
}));

vi.mock("@/lib/utils", () => ({
  formatDate: vi.fn(() => "01/01/2026"),
}));

import { generateRecapChargesLocataire } from "./recap-charges-locataire";

describe("generateRecapChargesLocataire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helperMocks.initPdf.mockResolvedValue(pdfCtx);
    pdfCtx.save.mockResolvedValue(Buffer.from("pdf-buffer"));
    pdfCtx.np.mockReturnValue({ id: "page-1" });
  });

  it("échoue si tenantId est absent", async () => {
    await expect(
      generateRecapChargesLocataire({
        societyId: "society-1",
        type: "RECAP_CHARGES_LOCATAIRE",
        year: 2026,
      })
    ).rejects.toThrow("tenantId requis pour ce rapport");
  });

  it("échoue si le locataire est introuvable", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);

    await expect(
      generateRecapChargesLocataire({
        societyId: "society-1",
        tenantId: "tenant-1",
        type: "RECAP_CHARGES_LOCATAIRE",
        year: 2026,
      })
    ).rejects.toThrow("Locataire introuvable");
  });

  it("génère un PDF avec message vide si aucun bail n'est trouvé", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      societyId: "society-1",
      entityType: "PERSONNE_PHYSIQUE",
      firstName: "Alice",
      lastName: "Durand",
      email: "alice@example.com",
      phone: "0600000000",
    } as never);
    prismaMock.lease.findMany.mockResolvedValue([] as never);

    const result = await generateRecapChargesLocataire({
      societyId: "society-1",
      tenantId: "tenant-1",
      type: "RECAP_CHARGES_LOCATAIRE",
      year: 2026,
      society: { name: "Ma Société" },
    });

    expect(result).toEqual({
      buffer: Buffer.from("pdf-buffer"),
      filename: "charges-locataire-tenant-1-2026.pdf",
      contentType: "application/pdf",
    });
    expect(helperMocks.drawEmptyMessage).toHaveBeenCalled();
    expect(helperMocks.drawCoverPage).toHaveBeenCalledWith(
      pdfCtx,
      "Récapitulatif des Charges",
      "Locataire : Alice Durand",
      expect.arrayContaining(["Société : Ma Société", "Exercice : 2026"])
    );
  });

  it("génère un PDF détaillé pour un bail avec provisions et régularisation", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      societyId: "society-1",
      entityType: "PERSONNE_MORALE",
      companyName: "ACME SAS",
      email: "contact@acme.fr",
      phone: null,
    } as never);
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        lot: {
          number: "A1",
          building: { name: "Immeuble Test" },
        },
        chargeProvisions: [
          { label: "Provision eau", monthlyAmount: 50 },
          { label: "Provision copro", monthlyAmount: 75 },
        ],
        chargeRegularizations: [
          {
            fiscalYear: 2026,
            totalCharges: 1600,
            totalProvisions: 1500,
            balance: 100,
          },
        ],
        invoices: [
          { totalTTC: 1200 },
          { totalTTC: 1300 },
        ],
      },
    ] as never);

    const result = await generateRecapChargesLocataire({
      societyId: "society-1",
      tenantId: "tenant-1",
      type: "RECAP_CHARGES_LOCATAIRE",
      year: 2026,
    });

    expect(result.filename).toBe("charges-locataire-tenant-1-2026.pdf");
    expect(helperMocks.drawTableHeader).toHaveBeenCalled();
    expect(helperMocks.drawTableRow).toHaveBeenCalledTimes(2);
    expect(helperMocks.drawTotalsRow).toHaveBeenCalled();
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Loyers appelés",
      "2500.00 EUR"
    );
    expect(prismaMock.lease.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        societyId: "society-1",
        tenantId: "tenant-1",
        deletedAt: null,
        status: { in: ["EN_COURS", "RENOUVELE", "RESILIE", "CONTENTIEUX"] },
        startDate: { lte: expect.any(Date) },
        OR: expect.arrayContaining([
          expect.objectContaining({ endDate: { gte: expect.any(Date) } }),
        ]),
      }),
      include: expect.objectContaining({
        chargeProvisions: expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            startDate: { lte: expect.any(Date) },
            OR: [
              { endDate: null },
              { endDate: { gte: expect.any(Date) } },
            ],
          }),
        }),
      }),
    }));
  });

  it("calcule les provisions sur les mois actifs dans l'exercice", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      societyId: "society-1",
      entityType: "PERSONNE_MORALE",
      companyName: "ACME SAS",
      email: null,
      phone: null,
    } as never);
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        lot: {
          number: "A1",
          building: { name: "Immeuble Test" },
        },
        chargeProvisions: [
          {
            label: "Provision juillet",
            monthlyAmount: 100,
            startDate: new Date("2026-07-01T00:00:00.000Z"),
            endDate: null,
          },
          {
            label: "Provision ancienne",
            monthlyAmount: 50,
            startDate: new Date("2025-10-01T00:00:00.000Z"),
            endDate: new Date("2026-03-31T00:00:00.000Z"),
          },
        ],
        chargeRegularizations: [],
        invoices: [],
      },
    ] as never);

    const result = await generateRecapChargesLocataire({
      societyId: "society-1",
      tenantId: "tenant-1",
      type: "RECAP_CHARGES_LOCATAIRE",
      year: 2026,
    });

    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTableHeader).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      ["Provision sur charges", "Mensuel", "Exercice"],
      expect.any(Array),
      expect.any(Array)
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      ["Provision juillet", "100.00 EUR", "600.00 EUR"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      ["Provision ancienne", "50.00 EUR", "150.00 EUR"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 1 })
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      ["Total provisions", "150.00 EUR", "750.00 EUR"],
      expect.any(Array),
      expect.any(Array)
    );
  });

  it("gère les sauts de page (lignes 63, 78, 87)", async () => {
    helperMocks.contentStartY.mockReturnValue(150);
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      societyId: "society-1",
      entityType: "PERSONNE_PHYSIQUE",
      firstName: "Alice",
      lastName: "Durand",
      email: null,
      phone: null,
    } as never);
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1",
        startDate: new Date("2026-01-01"),
        lot: { number: "A1", building: { name: "Immeuble Test" } },
        chargeProvisions: [
          { label: "Provision 1", monthlyAmount: 50 },
          { label: "Provision 2", monthlyAmount: 75 },
        ],
        chargeRegularizations: [
          { fiscalYear: 2026, totalCharges: 1600, totalProvisions: 1500, balance: 100 },
        ],
        invoices: [],
      },
    ] as never);

    const result = await generateRecapChargesLocataire({
      societyId: "society-1",
      tenantId: "tenant-1",
      type: "RECAP_CHARGES_LOCATAIRE",
      year: 2026,
    });

    helperMocks.contentStartY.mockReturnValue(700);
    expect(result.contentType).toBe("application/pdf");
    expect(pdfCtx.np).toHaveBeenCalledTimes(4); // initial + 3 page breaks
  });

  it("utilise l'année courante si year est absent (ligne 18)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      entityType: "PERSONNE_PHYSIQUE",
      firstName: "Alice",
      lastName: "Durand",
      email: null,
      phone: null,
    } as never);
    prismaMock.lease.findMany.mockResolvedValue([] as never);

    const currentYear = new Date().getFullYear();
    const result = await generateRecapChargesLocataire({
      societyId: "society-1",
      tenantId: "tenant-1",
      type: "RECAP_CHARGES_LOCATAIRE",
    });
    expect(result.filename).toBe(`charges-locataire-tenant-1-${currentYear}.pdf`);
  });

  it("affiche '-' pour PERSONNE_MORALE sans companyName (ligne 37), gère aucune provision (ligne 71) et balance <= 0 (ligne 88)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      entityType: "PERSONNE_MORALE",
      companyName: null,
      email: null,
      phone: null,
    } as never);
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1",
        startDate: new Date("2026-01-01"),
        lot: { number: "A1", building: { name: "Immeuble A" } },
        chargeProvisions: [],
        chargeRegularizations: [
          { fiscalYear: 2026, totalCharges: 1000, totalProvisions: 1200, balance: -200 },
        ],
        invoices: [],
      },
    ] as never);

    const result = await generateRecapChargesLocataire({
      societyId: "society-1",
      tenantId: "tenant-1",
      type: "RECAP_CHARGES_LOCATAIRE",
      year: 2026,
    });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTableHeader).not.toHaveBeenCalled();
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.bold, pdfCtx.reg, expect.any(Number),
      "Régularisation 2026", expect.any(String), undefined
    );
  });

  it("affiche '-' pour PERSONNE_PHYSIQUE sans nom (ligne 38)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      entityType: "PERSONNE_PHYSIQUE",
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
    } as never);
    prismaMock.lease.findMany.mockResolvedValue([] as never);

    const result = await generateRecapChargesLocataire({
      societyId: "society-1",
      tenantId: "tenant-1",
      type: "RECAP_CHARGES_LOCATAIRE",
      year: 2026,
    });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawCoverPage).toHaveBeenCalledWith(
      pdfCtx, "Récapitulatif des Charges", "Locataire : -", expect.any(Array)
    );
  });
});
