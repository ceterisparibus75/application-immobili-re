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

import { generateCompteRenduGestion } from "./compte-rendu-gestion";

describe("generateCompteRenduGestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helperMocks.initPdf.mockResolvedValue(pdfCtx);
    pdfCtx.save.mockResolvedValue(Buffer.from("pdf-buffer"));
    pdfCtx.np.mockReturnValue({ id: "page-1" });
    prismaMock.payment.findMany.mockResolvedValue([] as never);
    prismaMock.tenantBalanceAdjustment.findMany.mockResolvedValue([] as never);
  });

  it("rejette si la société est introuvable", async () => {
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.building.findMany.mockResolvedValue([] as never);

    await expect(
      generateCompteRenduGestion({
        societyId: "society-1",
        type: "COMPTE_RENDU_GESTION",
        year: 2026,
      })
    ).rejects.toThrow("Société introuvable");
  });

  it("calcule la synthèse annuelle et les sous-totaux par immeuble et locataire", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      id: "society-1",
      name: "Ma Société",
    } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        totalTTC: 1200,
        status: "PAYE",
        tenant: {
          entityType: "PERSONNE_PHYSIQUE",
          firstName: "Alice",
          lastName: "Durand",
          companyName: null,
        },
        lease: {
          lot: {
            buildingId: "building-1",
            number: "A1",
          },
        },
        payments: [{ amount: 1200, paidAt: new Date("2026-02-01T00:00:00.000Z") }],
      },
      {
        tenantId: "tenant-2",
        totalTTC: 800,
        status: "VALIDE",
        tenant: {
          entityType: "PERSONNE_MORALE",
          companyName: "ACME SAS",
          firstName: null,
          lastName: null,
        },
        lease: {
          lot: {
            buildingId: "building-1",
            number: "A2",
          },
        },
        payments: [{ amount: 300, paidAt: new Date("2026-03-01T00:00:00.000Z") }],
      },
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      {
        amount: 1200,
        invoice: {
          tenantId: "tenant-1",
          tenant: {
            entityType: "PERSONNE_PHYSIQUE",
            firstName: "Alice",
            lastName: "Durand",
            companyName: null,
          },
          buildingId: null,
          lease: {
            lot: {
              buildingId: "building-1",
              number: "A1",
            },
          },
        },
      },
      {
        amount: 300,
        invoice: {
          tenantId: "tenant-2",
          tenant: {
            entityType: "PERSONNE_MORALE",
            companyName: "ACME SAS",
            firstName: null,
            lastName: null,
          },
          buildingId: null,
          lease: {
            lot: {
              buildingId: "building-1",
              number: "A2",
            },
          },
        },
      },
    ] as never);
    prismaMock.charge.findMany.mockResolvedValue([
      {
        buildingId: "building-1",
        amount: 250,
      },
    ] as never);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [{ id: "lot-1" }, { id: "lot-2" }],
      },
    ] as never);

    const result = await generateCompteRenduGestion({
      societyId: "society-1",
      type: "COMPTE_RENDU_GESTION",
      year: 2026,
      society: { name: "Ma Société" },
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toBe("compte-rendu-gestion-2026.pdf");
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Total facturé",
      "2000.00 EUR"
    );
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Loyers encaissés (payés)",
      "1500.00 EUR",
      expect.anything()
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      ["TOTAL", "", "2000.00 EUR", "1500.00 EUR", "250.00 EUR", "500.00 EUR"],
      expect.any(Array),
      expect.any(Array)
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      ["ACME SAS", "A2", "800.00 EUR", "300.00 EUR", "500.00 EUR", "Impayé"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 1 })
    );
  });

  it("calcule l'encaissé sur les paiements de l'exercice, même si la facture vient d'un exercice précédent", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      id: "society-1",
      name: "Ma Société",
    } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        buildingId: null,
        totalTTC: 1000,
        status: "EN_ATTENTE",
        tenant: {
          entityType: "PERSONNE_MORALE",
          companyName: "ACME SAS",
          firstName: null,
          lastName: null,
        },
        lease: {
          lot: {
            buildingId: "building-1",
            number: "A2",
          },
        },
        payments: [],
      },
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      {
        amount: 600,
        invoice: {
          tenantId: "tenant-1",
          tenant: {
            entityType: "PERSONNE_MORALE",
            companyName: "ACME SAS",
            firstName: null,
            lastName: null,
          },
          buildingId: null,
          lease: {
            lot: {
              buildingId: "building-1",
              number: "A2",
            },
          },
        },
      },
      {
        amount: 250,
        invoice: {
          tenantId: "tenant-3",
          tenant: {
            entityType: "PERSONNE_PHYSIQUE",
            firstName: "Claire",
            lastName: "Martin",
            companyName: null,
          },
          buildingId: "building-1",
          lease: null,
        },
      },
    ] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [{ id: "lot-1" }],
      },
    ] as never);

    await generateCompteRenduGestion({
      societyId: "society-1",
      type: "COMPTE_RENDU_GESTION",
      year: 2026,
    });

    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Loyers encaissés (payés)",
      "850.00 EUR",
      expect.anything()
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      ["TOTAL", "", "1000.00 EUR", "850.00 EUR", "0.00 EUR", "1000.00 EUR"],
      expect.any(Array),
      expect.any(Array)
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      ["Immeuble A", "1", "1000.00 EUR", "850.00 EUR", "0.00 EUR", "1000.00 EUR"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      ["Claire Martin", "-", "0.00 EUR", "250.00 EUR", "0.00 EUR", "Soldé"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 1 })
    );
    expect(helperMocks.drawTotalsRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      expect.any(Number),
      ["SOUS-TOTAL", "", "1000.00 EUR", "850.00 EUR", "1000.00 EUR", ""],
      expect.any(Array),
      expect.any(Array)
    );
  });

  it("inclut les reprises de solde dans les soldes sans les ajouter au total facturé", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      id: "society-1",
      name: "Ma Société",
    } as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.payment.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.tenantBalanceAdjustment.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        amount: 3544.76,
        dueDate: new Date("2026-04-01T00:00:00.000Z"),
        tenant: {
          entityType: "PERSONNE_MORALE",
          companyName: "KSR",
          firstName: null,
          lastName: null,
        },
        lease: {
          lot: {
            buildingId: "building-1",
            number: "A1",
          },
        },
      },
    ] as never);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        lots: [{ id: "lot-1" }],
      },
    ] as never);

    await generateCompteRenduGestion({
      societyId: "society-1",
      type: "COMPTE_RENDU_GESTION",
      year: 2026,
    });

    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Total facturé",
      "0.00 EUR"
    );
    expect(helperMocks.drawKpiRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.bold,
      pdfCtx.reg,
      expect.any(Number),
      "Loyers en attente / retard",
      "3544.76 EUR",
      expect.anything()
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      ["Immeuble A", "1", "0.00 EUR", "0.00 EUR", "0.00 EUR", "3544.76 EUR"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      { id: "page-1" },
      pdfCtx.reg,
      expect.any(Number),
      ["KSR", "A1", "0.00 EUR", "0.00 EUR", "3544.76 EUR", "Impayé"],
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ rowIndex: 0 })
    );
  });

  it("affiche un message vide si aucune facture et aucune charge (ligne 69)", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ id: "society-1", name: "Test" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.building.findMany.mockResolvedValue([] as never);

    const result = await generateCompteRenduGestion({
      societyId: "society-1",
      type: "COMPTE_RENDU_GESTION",
      year: 2026,
    });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawEmptyMessage).toHaveBeenCalled();
  });

  it("utilise l'année courante si opts.year est absent (ligne 26)", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ id: "society-1", name: "Soc" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.building.findMany.mockResolvedValue([] as never);

    const result = await generateCompteRenduGestion({ societyId: "society-1", type: "COMPTE_RENDU_GESTION" });
    expect(result.contentType).toBe("application/pdf");
    const currentYear = new Date().getFullYear();
    expect(result.filename).toBe(`compte-rendu-gestion-${currentYear}.pdf`);
  });

  it("gère plusieurs factures pour le même locataire (ligne 125) et noms vides (lignes 134-136)", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ id: "society-1", name: "Soc" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        totalTTC: 800,
        status: "PAYE",
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: null, lastName: null, companyName: null },
        lease: { lot: { buildingId: "building-1", number: "A1" } },
        payments: [{ amount: 800, paidAt: new Date("2026-02-01T00:00:00.000Z") }],
      },
      {
        tenantId: "tenant-1",
        totalTTC: 900,
        status: "PAYE",
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: null, lastName: null, companyName: null },
        lease: { lot: { buildingId: "building-1", number: "A1" } },
        payments: [{ amount: 900, paidAt: new Date("2026-03-01T00:00:00.000Z") }],
      },
      {
        tenantId: "tenant-2",
        totalTTC: 500,
        status: "VALIDE",
        tenant: { entityType: "PERSONNE_MORALE", companyName: null, firstName: null, lastName: null },
        lease: { lot: { buildingId: "building-1", number: "B1" } },
        payments: [],
      },
    ] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.building.findMany.mockResolvedValue([
      { id: "building-1", name: "Immeuble A", lots: [{ id: "lot-1" }] },
    ] as never);

    const result = await generateCompteRenduGestion({
      societyId: "society-1",
      type: "COMPTE_RENDU_GESTION",
      year: 2026,
    });
    expect(result.contentType).toBe("application/pdf");
    // Nom "-" pour les deux cas (PERSONNE_PHYSIQUE vide et PERSONNE_MORALE sans companyName)
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.reg, expect.any(Number),
      expect.arrayContaining(["-"]),
      expect.any(Array), expect.any(Array), expect.objectContaining({ rowIndex: 0 })
    );
  });

  it("gère lot.number null → lotNum '-' (ligne 136)", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ id: "society-1", name: "Test" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        totalTTC: 500,
        status: "VALIDE",
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Bob", lastName: "Dupont", companyName: null },
        lease: { lot: { buildingId: "building-1", number: null } },
        payments: [],
      },
    ] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.building.findMany.mockResolvedValue([
      { id: "building-1", name: "Immeuble A", lots: [{ id: "lot-1" }] },
    ] as never);

    const result = await generateCompteRenduGestion({
      societyId: "society-1",
      type: "COMPTE_RENDU_GESTION",
      year: 2026,
    });
    expect(result.contentType).toBe("application/pdf");
    expect(helperMocks.drawTableRow).toHaveBeenCalledWith(
      expect.anything(), pdfCtx.reg, expect.any(Number),
      expect.arrayContaining(["Bob Dupont", "-"]),
      expect.any(Array), expect.any(Array), expect.anything()
    );
  });

  it("gère les sauts de page et ignore les immeubles sans factures (lignes 92-94, 112, 114, 146-148)", async () => {
    helperMocks.contentStartY.mockReturnValue(150);
    prismaMock.society.findUnique.mockResolvedValue({ id: "society-1", name: "Test Société" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        tenantId: "tenant-1",
        totalTTC: 1200,
        status: "PAYE",
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Alice", lastName: "Durand", companyName: null },
        lease: { lot: { buildingId: "building-1", number: "A1" } },
        payments: [{ amount: 1200, paidAt: new Date("2026-02-01T00:00:00.000Z") }],
      },
      {
        tenantId: "tenant-2",
        totalTTC: 800,
        status: "VALIDE",
        tenant: { entityType: "PERSONNE_MORALE", companyName: "ACME SAS", firstName: null, lastName: null },
        lease: { lot: { buildingId: "building-1", number: "A2" } },
        payments: [],
      },
    ] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.building.findMany.mockResolvedValue([
      { id: "building-1", name: "Immeuble A", lots: [{ id: "lot-1" }] },
      { id: "building-2", name: "Immeuble B", lots: [{ id: "lot-2" }] },
    ] as never);

    const result = await generateCompteRenduGestion({
      societyId: "society-1",
      type: "COMPTE_RENDU_GESTION",
      year: 2026,
    });

    helperMocks.contentStartY.mockReturnValue(700);
    expect(result.contentType).toBe("application/pdf");
    expect(pdfCtx.np).toHaveBeenCalledTimes(4); // initial + lines 92-94 + line 114 + lines 146-148
  });
});
