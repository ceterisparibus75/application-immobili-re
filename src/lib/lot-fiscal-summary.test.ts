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

describe("buildLotFiscalSummary", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("avertit quand des maintenances existent en démembrement (non classées auto)", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([
      { id: "m-1", cost: 8500, completedAt: new Date("2026-05-10"), scheduledAt: null, title: "Toiture" },
    ] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.maintenanceCostTotal).toBe(8500);
    expect(result.maintenanceCount).toBe(1);
    expect(
      result.notes.some(
        (n) => n.level === "warning" && /art\. ?606/.test(n.text),
      ),
    ).toBe(true);
  });

  it("PP simple avec maintenances : note info (déductibles), pas warning", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "alice", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([
      { id: "m-1", cost: 500, completedAt: new Date("2026-04-10"), scheduledAt: null, title: "Plomberie" },
    ] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.notes.some((n) => n.level === "warning")).toBe(false);
    expect(result.notes.some((n) => n.text.includes("déductibles"))).toBe(true);
  });

  it("indivision : note explicite", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "alice", share: 0.5, label: "Alice SCI" }),
      ownershipRow({ proprietaireId: "bob", share: 0.5, label: "Bob" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.maintenance.findMany.mockResolvedValue([] as never);

    const result = await buildLotFiscalSummary(SOCIETY_ID, LOT_ID, 2026);

    expect(result.notes.some((n) => n.text.toLowerCase().includes("indivision"))).toBe(true);
  });
});
