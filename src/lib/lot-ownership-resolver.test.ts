import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

import {
  isLotDismembered,
  resolveActiveOwnership,
  resolveBeneficiariesForLot,
  resolveBeneficiaryForCashflowCategory,
  resolveBeneficiaryForPayment,
  resolveRentBeneficiary,
} from "./lot-ownership-resolver";

const SOCIETY_ID = "society-1";
const LOT_ID = "lot-1";

function row(over: Partial<{
  id: string;
  proprietaireId: string;
  type: "PLEINE_PROPRIETE" | "USUFRUIT" | "NUE_PROPRIETE";
  share: number;
  startDate: Date;
  endDate: Date | null;
  isViager: boolean;
  usufruitierBirthDate: Date | null;
  label: string;
}>) {
  const proprietaireId = over.proprietaireId ?? "p1";
  return {
    id: over.id ?? "lo-1",
    proprietaireId,
    type: over.type ?? "PLEINE_PROPRIETE",
    share: over.share ?? 1,
    startDate: over.startDate ?? new Date("2020-01-01"),
    endDate: over.endDate ?? null,
    isViager: over.isViager ?? false,
    usufruitierBirthDate: over.usufruitierBirthDate ?? null,
    proprietaire: { id: proprietaireId, label: over.label ?? proprietaireId.toUpperCase() },
  };
}

describe("resolveActiveOwnership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne un snapshot vide pour un lot sans propriétaire enregistré", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([] as never);

    const result = await resolveActiveOwnership(SOCIETY_ID, LOT_ID, new Date("2026-05-15"));

    expect(result.snapshot.isDismembered).toBe(false);
    expect(result.snapshot.full).toEqual([]);
    expect(result.proprietaires.size).toBe(0);
  });

  it("retourne le snapshot et les proprios pour un démembrement actif", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
      row({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
    ] as never);

    const result = await resolveActiveOwnership(SOCIETY_ID, LOT_ID, new Date("2026-05-15"));

    expect(result.snapshot.isDismembered).toBe(true);
    expect(result.snapshot.usufruit).toHaveLength(1);
    expect(result.snapshot.nuePropriete).toHaveLength(1);
    expect(result.proprietaires.get("alice")?.label).toBe("Alice SCI");
    expect(result.proprietaires.get("bob")?.label).toBe("Bob");
  });

  it("scopes la requête par societyId et lotId", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([] as never);

    await resolveActiveOwnership(SOCIETY_ID, LOT_ID);

    expect(prismaMock.lotOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: SOCIETY_ID, lotId: LOT_ID },
      }),
    );
  });
});

describe("isLotDismembered", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renvoie false en pleine propriété", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([row({})] as never);
    expect(await isLotDismembered(SOCIETY_ID, LOT_ID)).toBe(false);
  });

  it("renvoie true en démembrement", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "alice", type: "NUE_PROPRIETE" }),
      row({ proprietaireId: "bob", type: "USUFRUIT" }),
    ] as never);
    expect(await isLotDismembered(SOCIETY_ID, LOT_ID)).toBe(true);
  });
});

describe("resolveBeneficiariesForLot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loyer en démembrement → usufruitier (Bob)", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
      row({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
    ] as never);

    const result = await resolveBeneficiariesForLot(SOCIETY_ID, LOT_ID, 1200, "REVENU");

    expect(result).toHaveLength(1);
    expect(result[0].proprietaire.label).toBe("Bob");
    expect(result[0].role).toBe("USUFRUITIER");
    expect(result[0].amount).toBe(1200);
  });

  it("gros travaux en démembrement → nu-propriétaire (Alice)", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
      row({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
    ] as never);

    const result = await resolveBeneficiariesForLot(SOCIETY_ID, LOT_ID, 15000, "GROS_TRAVAUX");

    expect(result).toHaveLength(1);
    expect(result[0].proprietaire.label).toBe("Alice SCI");
    expect(result[0].role).toBe("NU_PROPRIETAIRE");
    expect(result[0].amount).toBe(15000);
  });

  it("indivision 50/50 en pleine propriété → ventile", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "alice", share: 0.5, label: "Alice SCI" }),
      row({ proprietaireId: "bob", share: 0.5, label: "Bob" }),
    ] as never);

    const result = await resolveBeneficiariesForLot(SOCIETY_ID, LOT_ID, 1000, "REVENU");

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.proprietaire.label === "Alice SCI")?.amount).toBe(500);
    expect(result.find((r) => r.proprietaire.label === "Bob")?.amount).toBe(500);
  });
});

describe("resolveRentBeneficiary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renvoie l'usufruitier pour un démembrement simple", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
      row({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
    ] as never);

    const result = await resolveRentBeneficiary(SOCIETY_ID, LOT_ID);

    expect(result).not.toBeNull();
    expect(result?.proprietaire.label).toBe("Bob");
    expect(result?.isUsufruct).toBe(true);
  });

  it("renvoie le plein propriétaire pour un lot en PP simple", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "alice", label: "Alice SCI" }),
    ] as never);

    const result = await resolveRentBeneficiary(SOCIETY_ID, LOT_ID);

    expect(result?.proprietaire.label).toBe("Alice SCI");
    expect(result?.isUsufruct).toBe(false);
  });

  it("renvoie null en indivision (plusieurs bénéficiaires)", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "alice", share: 0.5, label: "Alice SCI" }),
      row({ proprietaireId: "bob", share: 0.5, label: "Bob" }),
    ] as never);

    const result = await resolveRentBeneficiary(SOCIETY_ID, LOT_ID);
    expect(result).toBeNull();
  });

  it("renvoie null pour un lot sans propriétaire enregistré", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([] as never);
    const result = await resolveRentBeneficiary(SOCIETY_ID, LOT_ID);
    expect(result).toBeNull();
  });
});

describe("resolveBeneficiaryForCashflowCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loyers + démembrement → usufruitier", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      row({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);

    const result = await resolveBeneficiaryForCashflowCategory(
      SOCIETY_ID,
      LOT_ID,
      "loyers",
      1200,
    );
    expect(result).not.toBeNull();
    expect(result![0].proprietaire.label).toBe("Bob");
  });

  it("travaux + démembrement → nu-propriétaire", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      row({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);

    const result = await resolveBeneficiaryForCashflowCategory(
      SOCIETY_ID,
      LOT_ID,
      "travaux",
      8000,
    );
    expect(result).not.toBeNull();
    expect(result![0].proprietaire.label).toBe("Alice SCI");
  });

  it("retourne null pour les catégories neutres", async () => {
    const result = await resolveBeneficiaryForCashflowCategory(
      SOCIETY_ID,
      LOT_ID,
      "virement_interne",
      500,
    );
    expect(result).toBeNull();
    expect(prismaMock.lotOwnership.findMany).not.toHaveBeenCalled();
  });
});

describe("resolveBeneficiaryForPayment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("remonte Payment → Invoice → Lease → Lot", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      paidAt: new Date("2026-05-15"),
      invoice: { lease: { lotId: LOT_ID } },
    } as never);
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      row({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      row({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);

    const result = await resolveBeneficiaryForPayment(SOCIETY_ID, "pay-1");

    expect(result).not.toBeNull();
    expect(result?.proprietaire.label).toBe("Bob");
    expect(result?.isUsufruct).toBe(true);
  });

  it("renvoie null pour une facture sans bail (ex. facture libre)", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({
      paidAt: new Date("2026-05-15"),
      invoice: { lease: null },
    } as never);

    expect(await resolveBeneficiaryForPayment(SOCIETY_ID, "pay-1")).toBeNull();
  });

  it("renvoie null si le paiement est introuvable", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);
    expect(await resolveBeneficiaryForPayment(SOCIETY_ID, "pay-1")).toBeNull();
  });
});
