import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

import { buildLotFiscalSummary } from "./lot-fiscal-summary";

const SOCIETY_ID = "society-1";
const LOT_ID = "lot-1";

function ownershipRow(over: Partial<{
  proprietaireId: string;
  type: "PLEINE_PROPRIETE" | "USUFRUIT" | "NUE_PROPRIETE";
  share: number;
  startDate: Date;
  endDate: Date | null;
  label: string;
}>) {
  const proprietaireId = over.proprietaireId ?? "p1";
  return {
    proprietaireId,
    type: over.type ?? "PLEINE_PROPRIETE",
    share: over.share ?? 1,
    startDate: over.startDate ?? new Date("2020-01-01"),
    endDate: over.endDate ?? null,
    isViager: false,
    usufruitierBirthDate: null,
    proprietaire: { id: proprietaireId, label: over.label ?? proprietaireId.toUpperCase() },
  };
}

function maintenanceRow(over: Partial<{
  id: string;
  cost: number;
  completedAt: Date | null;
  scheduledAt: Date | null;
  title: string;
  nature: "ENTRETIEN_COURANT" | "GROSSE_REPARATION" | "AMELIORATION";
}>) {
  return {
    id: over.id ?? "m-" + Math.random().toString(36).slice(2, 8),
    cost: over.cost ?? 500,
    completedAt: over.completedAt ?? new Date("2026-05-10"),
    scheduledAt: over.scheduledAt ?? null,
    title: over.title ?? "Intervention",
    nature: over.nature ?? "ENTRETIEN_COURANT",
  };
}

describe("buildLotFiscalSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : pas de charges immeuble allouées (tests existants ne
    // testent que loyers + maintenance directe). Les tests dédiés aux
    // charges immeuble remplaceront ces mocks.
    prismaMock.lot.findFirst.mockResolvedValue(null);
    prismaMock.lot.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
  });

  it("avertit quand le lot n'a aucun régime de propriété", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.hasOwnershipData).toBe(false);
    expect(result.notes.some((n) => n.level === "warning")).toBe(true);
    expect(result.byBeneficiary).toEqual([]);
  });

  it("synthèse PP simple : un seul bénéficiaire, note neutre", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "alice", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-1",
        issueDate: new Date("2026-02-01"),
        totalTTC: 1200,
        isThirdPartyManaged: false,
        expectedNetAmount: null,
        payments: [{ amount: 1200, paidAt: new Date("2026-02-15") }],
      },
    ] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.isDismembered).toBe(false);
    expect(result.byBeneficiary).toHaveLength(1);
    expect(result.byBeneficiary[0].recettes).toBe(1200);
    expect(result.byBeneficiary[0].role).toBe("PLEIN_PROPRIETAIRE");
    expect(result.notes.some((n) => /art\. ?5\d\d/.test(n.text))).toBe(false);
  });

  it("démembrement : note art. 578/605/606 CC + recettes côté usufruitier", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-1",
        issueDate: new Date("2026-02-01"),
        totalTTC: 1200,
        isThirdPartyManaged: false,
        expectedNetAmount: null,
        payments: [{ amount: 1200, paidAt: new Date("2026-02-15") }],
      },
    ] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.isDismembered).toBe(true);
    expect(result.byBeneficiary.find((b) => b.role === "USUFRUITIER")?.recettes).toBe(1200);
    expect(result.notes.some((n) => n.text.includes("art. 578"))).toBe(true);
    expect(result.notes.some((n) => n.text.includes("Intérêts d'emprunt"))).toBe(true);
  });

  it("GROSSE_REPARATION en démembrement → allouée au nu-propriétaire (charges déductibles)", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([
      maintenanceRow({ cost: 8500, nature: "GROSSE_REPARATION", title: "Toiture" }),
    ] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    const alice = result.byBeneficiary.find((b) => b.role === "NU_PROPRIETAIRE");
    const bob = result.byBeneficiary.find((b) => b.role === "USUFRUITIER");
    expect(alice?.chargesDeductibles).toBe(8500);
    expect(bob?.chargesDeductibles ?? 0).toBe(0);
    expect(result.maintenanceByNature.grosseReparation).toBe(8500);
    // Plus de warning manuel sur les maintenances en démembrement
    expect(
      result.notes.some(
        (n) => n.level === "warning" && /ventiler manuellement/i.test(n.text),
      ),
    ).toBe(false);
  });

  it("ENTRETIEN_COURANT en démembrement → alloué à l'usufruitier", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([
      maintenanceRow({ cost: 600, nature: "ENTRETIEN_COURANT", title: "Plomberie" }),
    ] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    const bob = result.byBeneficiary.find((b) => b.role === "USUFRUITIER");
    const alice = result.byBeneficiary.find((b) => b.role === "NU_PROPRIETAIRE");
    expect(bob?.chargesDeductibles).toBe(600);
    expect(alice?.chargesDeductibles ?? 0).toBe(0);
    expect(result.maintenanceByNature.entretienCourant).toBe(600);
  });

  it("AMELIORATION : non déductible des revenus fonciers + note dédiée", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([
      maintenanceRow({ cost: 25000, nature: "AMELIORATION", title: "Extension véranda" }),
    ] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.maintenanceByNature.amelioration).toBe(25000);
    // Personne ne déduit l'amélioration (capital)
    expect(
      result.byBeneficiary.every((b) => b.chargesDeductibles === 0),
    ).toBe(true);
    expect(
      result.notes.some((n) => /amélioration/i.test(n.text) && /capital/i.test(n.text)),
    ).toBe(true);
  });

  it("mix des 3 natures en démembrement : ventilation correcte", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([
      maintenanceRow({ cost: 1000, nature: "ENTRETIEN_COURANT" }),
      maintenanceRow({ cost: 5000, nature: "GROSSE_REPARATION" }),
      maintenanceRow({ cost: 20000, nature: "AMELIORATION" }),
    ] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.maintenanceCostTotal).toBe(26000);
    expect(result.byBeneficiary.find((b) => b.role === "USUFRUITIER")?.chargesDeductibles).toBe(1000);
    expect(result.byBeneficiary.find((b) => b.role === "NU_PROPRIETAIRE")?.chargesDeductibles).toBe(5000);
    expect(result.maintenanceByNature).toEqual({
      entretienCourant: 1000,
      grosseReparation: 5000,
      amelioration: 20000,
    });
  });

  it("PP simple : toutes les natures déductibles sont à la charge du plein propriétaire", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "alice", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([
      maintenanceRow({ cost: 800, nature: "ENTRETIEN_COURANT" }),
      maintenanceRow({ cost: 4200, nature: "GROSSE_REPARATION" }),
    ] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.byBeneficiary).toHaveLength(1);
    expect(result.byBeneficiary[0].chargesDeductibles).toBe(5000);
    expect(result.byBeneficiary[0].role).toBe("PLEIN_PROPRIETAIRE");
  });

  it("indivision en PP : note explicite", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "alice", share: 0.5, label: "Alice SCI" }),
      ownershipRow({ proprietaireId: "bob", share: 0.5, label: "Bob" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.notes.some((n) => n.text.toLowerCase().includes("indivision"))).toBe(true);
  });

  describe("charges immeuble allouées", () => {
    function setupLotWithBuilding() {
      prismaMock.lot.findFirst.mockResolvedValue({
        id: LOT_ID,
        buildingId: "b1",
        area: 80,
        commonShares: 600,
      } as never);
      prismaMock.lot.findMany.mockResolvedValue([
        { id: LOT_ID, area: 80, commonShares: 600 },
        { id: "lot-2", area: 120, commonShares: 400 },
      ] as never);
    }

    it("PP simple : charges propriétaire au tantième 60/40 → 60 % sur le lot, à charge du PP", async () => {
      prismaMock.lotOwnership.findMany.mockResolvedValue([
        ownershipRow({ proprietaireId: "alice", label: "Alice SCI" }),
      ] as never);
      prismaMock.invoice.findMany.mockResolvedValue([] as never);
      prismaMock.maintenance.findMany.mockResolvedValue([] as never);
      setupLotWithBuilding();
      prismaMock.charge.findMany.mockResolvedValue([
        {
          id: "c1",
          categoryId: "cat-1",
          description: "Taxe foncière",
          amount: 2000,
          date: new Date("2026-04-15"),
          category: {
            id: "cat-1",
            name: "Taxe foncière",
            nature: "PROPRIETAIRE",
            recoverableRate: null,
            allocationMethod: "TANTIEME",
            allocationKeys: [],
          },
        },
      ] as never);

      const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

      // 2000 € * 60 % = 1200 € alloués au lot, charge du PP
      expect(result.buildingChargesAllocated).toBe(1200);
      expect(result.byBeneficiary[0].chargesDeductibles).toBe(1200);
    });

    it("démembrement : charges immeuble → usufruitier", async () => {
      prismaMock.lotOwnership.findMany.mockResolvedValue([
        ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
        ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
      ] as never);
      prismaMock.invoice.findMany.mockResolvedValue([] as never);
      prismaMock.maintenance.findMany.mockResolvedValue([] as never);
      setupLotWithBuilding();
      prismaMock.charge.findMany.mockResolvedValue([
        {
          id: "c1",
          categoryId: "cat-1",
          description: "Copropriété T1",
          amount: 1000,
          date: new Date("2026-03-01"),
          category: {
            id: "cat-1",
            name: "Copropriété",
            nature: "PROPRIETAIRE",
            recoverableRate: null,
            allocationMethod: "TANTIEME",
            allocationKeys: [],
          },
        },
      ] as never);

      const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

      // 1000 € * 60 % = 600 € → usufruitier (Bob)
      expect(result.buildingChargesAllocated).toBe(600);
      expect(result.byBeneficiary.find((b) => b.role === "USUFRUITIER")?.chargesDeductibles).toBe(600);
      expect(result.byBeneficiary.find((b) => b.role === "NU_PROPRIETAIRE")?.chargesDeductibles ?? 0).toBe(0);
    });

    it("charge récupérable n'est pas allouée au propriétaire", async () => {
      prismaMock.lotOwnership.findMany.mockResolvedValue([
        ownershipRow({ proprietaireId: "alice", label: "Alice SCI" }),
      ] as never);
      prismaMock.invoice.findMany.mockResolvedValue([] as never);
      prismaMock.maintenance.findMany.mockResolvedValue([] as never);
      setupLotWithBuilding();
      prismaMock.charge.findMany.mockResolvedValue([
        {
          id: "c1",
          categoryId: "cat-1",
          description: "Ascenseur",
          amount: 500,
          date: new Date("2026-06-01"),
          category: {
            id: "cat-1",
            name: "Ascenseur",
            nature: "RECUPERABLE",
            recoverableRate: 100,
            allocationMethod: "TANTIEME",
            allocationKeys: [],
          },
        },
      ] as never);

      const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);
      expect(result.buildingChargesAllocated).toBe(0);
    });
  });
});
