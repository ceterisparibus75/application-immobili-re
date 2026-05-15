import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

import { buildLotRevenueBreakdown } from "./lot-revenue-breakdown";

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

function invoiceRow(over: Partial<{
  issueDate: Date;
  totalTTC: number;
  payments: Array<{ amount: number; paidAt: Date | null }>;
}>) {
  return {
    id: "inv-" + Math.random().toString(36).slice(2, 8),
    issueDate: over.issueDate ?? new Date("2026-02-01"),
    totalTTC: over.totalTTC ?? 1200,
    isThirdPartyManaged: false,
    expectedNetAmount: null,
    payments: over.payments ?? [],
  };
}

describe("buildLotRevenueBreakdown", () => {
  beforeEach(() => vi.clearAllMocks());

  it("alloue tout au plein propriétaire en PP simple", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "alice", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      invoiceRow({
        issueDate: new Date("2026-02-01"),
        totalTTC: 1200,
        payments: [{ amount: 1200, paidAt: new Date("2026-02-10") }],
      }),
    ] as never);

    const result = await buildLotRevenueBreakdown(
      SOCIETY_ID,
      LOT_ID,
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );

    expect(result.isDismembered).toBe(false);
    expect(result.byBeneficiary).toHaveLength(1);
    expect(result.byBeneficiary[0].proprietaireLabel).toBe("Alice SCI");
    expect(result.byBeneficiary[0].role).toBe("PLEIN_PROPRIETAIRE");
    expect(result.byBeneficiary[0].encaisse).toBe(1200);
    expect(result.byBeneficiary[0].quittance).toBe(1200);
    expect(result.byBeneficiary[0].outstanding).toBe(0);
  });

  it("alloue 100 % à l'usufruitier en démembrement", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      invoiceRow({
        issueDate: new Date("2026-02-01"),
        totalTTC: 1200,
        payments: [{ amount: 1200, paidAt: new Date("2026-02-10") }],
      }),
    ] as never);

    const result = await buildLotRevenueBreakdown(
      SOCIETY_ID,
      LOT_ID,
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );

    expect(result.isDismembered).toBe(true);
    expect(result.byBeneficiary).toHaveLength(1);
    expect(result.byBeneficiary[0].proprietaireLabel).toBe("Bob");
    expect(result.byBeneficiary[0].role).toBe("USUFRUITIER");
    expect(result.byBeneficiary[0].encaisse).toBe(1200);
  });

  it("respecte un changement de régime au cours de l'année", async () => {
    // PP Alice jusqu'au 1er juillet, puis démembrement → usufruit Bob
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({
        proprietaireId: "alice",
        type: "PLEINE_PROPRIETE",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2026-07-01"),
        label: "Alice SCI",
      }),
      ownershipRow({
        proprietaireId: "bob",
        type: "USUFRUIT",
        startDate: new Date("2026-07-01"),
        label: "Bob",
      }),
      ownershipRow({
        proprietaireId: "alice",
        type: "NUE_PROPRIETE",
        startDate: new Date("2026-07-01"),
        label: "Alice SCI",
      }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      invoiceRow({
        issueDate: new Date("2026-03-01"),
        totalTTC: 1200,
        payments: [{ amount: 1200, paidAt: new Date("2026-03-10") }],
      }),
      invoiceRow({
        issueDate: new Date("2026-09-01"),
        totalTTC: 1200,
        payments: [{ amount: 1200, paidAt: new Date("2026-09-10") }],
      }),
    ] as never);

    const result = await buildLotRevenueBreakdown(
      SOCIETY_ID,
      LOT_ID,
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );

    const alice = result.byBeneficiary.find((b) => b.proprietaireLabel === "Alice SCI");
    const bob = result.byBeneficiary.find((b) => b.proprietaireLabel === "Bob");

    expect(alice?.encaisse).toBe(1200); // paiement de mars (avant démembrement)
    expect(bob?.encaisse).toBe(1200); // paiement de septembre (après démembrement)
  });

  it("comptabilise l'outstanding sur les factures non soldées", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      invoiceRow({
        issueDate: new Date("2026-02-01"),
        totalTTC: 1200,
        payments: [{ amount: 500, paidAt: new Date("2026-02-15") }],
      }),
    ] as never);

    const result = await buildLotRevenueBreakdown(
      SOCIETY_ID,
      LOT_ID,
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );

    const bob = result.byBeneficiary.find((b) => b.proprietaireLabel === "Bob");
    expect(bob?.encaisse).toBe(500);
    expect(bob?.outstanding).toBe(700);
    expect(bob?.quittance).toBe(1200);
  });

  it("ignore les paiements hors période", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "alice", label: "Alice SCI" }),
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      invoiceRow({
        issueDate: new Date("2026-01-01"),
        totalTTC: 1200,
        payments: [
          { amount: 600, paidAt: new Date("2026-06-01") },
          { amount: 600, paidAt: new Date("2027-01-01") }, // hors période
        ],
      }),
    ] as never);

    const result = await buildLotRevenueBreakdown(
      SOCIETY_ID,
      LOT_ID,
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );

    expect(result.byBeneficiary[0].encaisse).toBe(600);
  });

  it("indique l'absence de données propriétaire si le lot n'a aucune ownership", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);

    const result = await buildLotRevenueBreakdown(
      SOCIETY_ID,
      LOT_ID,
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );

    expect(result.hasOwnershipData).toBe(false);
    expect(result.byBeneficiary).toEqual([]);
    expect(result.totals).toEqual({ encaisse: 0, quittance: 0, outstanding: 0 });
  });
});
