import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

// Mock encrypt/decrypt pour ne pas dépendre de ENCRYPTION_KEY en test
vi.mock("@/lib/encryption", () => ({
  encrypt: (s: string) => `enc:${s}`,
  decrypt: (s: string) => (s.startsWith("enc:") ? s.slice(4) : s),
}));

import { resolveInvoiceBankDetails } from "./invoice-bank-details";

const SOCIETY_ID = "society-1";
const LOT_ID = "lot-1";

const SOCIETY_BANK = {
  ibanEncrypted: "enc:FR1420041010050500013M02606",
  bicEncrypted: "enc:PSSTFRPPPAR",
  bankName: "La Banque Postale",
};

function ownershipRow(over: Partial<{
  proprietaireId: string;
  type: "PLEINE_PROPRIETE" | "USUFRUIT" | "NUE_PROPRIETE";
  share: number;
  label: string;
}>) {
  const proprietaireId = over.proprietaireId ?? "p1";
  return {
    proprietaireId,
    type: over.type ?? "PLEINE_PROPRIETE",
    share: over.share ?? 1,
    startDate: new Date("2020-01-01"),
    endDate: null,
    isViager: false,
    usufruitierBirthDate: null,
    proprietaire: { id: proprietaireId, label: over.label ?? proprietaireId.toUpperCase() },
  };
}

describe("resolveInvoiceBankDetails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sans bail (lotId null) → RIB de la société", async () => {
    const result = await resolveInvoiceBankDetails(SOCIETY_ID, SOCIETY_BANK, null, new Date("2026-05-15"));
    expect(result.iban).toBe("FR1420041010050500013M02606");
    expect(result.bic).toBe("PSSTFRPPPAR");
    expect(result.bankName).toBe("La Banque Postale");
    expect(result.fromUsufructuary).toBe(false);
  });

  it("PP simple → RIB de la société (pas de substitution)", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "alice", label: "Alice SCI" }),
    ] as never);

    const result = await resolveInvoiceBankDetails(SOCIETY_ID, SOCIETY_BANK, LOT_ID, new Date("2026-05-15"));
    expect(result.iban).toBe("FR1420041010050500013M02606");
    expect(result.fromUsufructuary).toBe(false);
  });

  it("démembrement + RIB usufruitier renseigné → substitution", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.proprietaire.findFirst.mockResolvedValue({
      ibanEncrypted: "enc:FR7630006000011234567890189",
      bicEncrypted: "enc:BNPAFRPP",
      bankName: "Banque de Bob",
      label: "Bob",
    } as never);

    const result = await resolveInvoiceBankDetails(SOCIETY_ID, SOCIETY_BANK, LOT_ID, new Date("2026-05-15"));

    expect(result.iban).toBe("FR7630006000011234567890189");
    expect(result.bic).toBe("BNPAFRPP");
    expect(result.bankName).toBe("Banque de Bob");
    expect(result.fromUsufructuary).toBe(true);
    expect(result.beneficiaryLabel).toBe("Bob");
  });

  it("démembrement + usufruitier sans RIB → fallback société + label informatif", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", label: "Bob" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);
    prismaMock.proprietaire.findFirst.mockResolvedValue({
      ibanEncrypted: null,
      bicEncrypted: null,
      bankName: null,
      label: "Bob",
    } as never);

    const result = await resolveInvoiceBankDetails(SOCIETY_ID, SOCIETY_BANK, LOT_ID, new Date("2026-05-15"));

    expect(result.iban).toBe("FR1420041010050500013M02606");
    expect(result.fromUsufructuary).toBe(false);
    expect(result.beneficiaryLabel).toBe("Bob");
  });

  it("indivision US (2 usufruitiers) → fallback société (résolveur ne renvoie pas un unique bénéficiaire)", async () => {
    prismaMock.lotOwnership.findMany.mockResolvedValue([
      ownershipRow({ proprietaireId: "bob", type: "USUFRUIT", share: 0.5, label: "Bob" }),
      ownershipRow({ proprietaireId: "carol", type: "USUFRUIT", share: 0.5, label: "Carol" }),
      ownershipRow({ proprietaireId: "alice", type: "NUE_PROPRIETE", label: "Alice SCI" }),
    ] as never);

    const result = await resolveInvoiceBankDetails(SOCIETY_ID, SOCIETY_BANK, LOT_ID, new Date("2026-05-15"));

    expect(result.iban).toBe("FR1420041010050500013M02606");
    expect(result.fromUsufructuary).toBe(false);
  });

  it("société sans RIB chiffré → renvoie null", async () => {
    const result = await resolveInvoiceBankDetails(
      SOCIETY_ID,
      { ibanEncrypted: null, bicEncrypted: null, bankName: null },
      null,
      new Date("2026-05-15"),
    );
    expect(result.iban).toBeNull();
    expect(result.bic).toBeNull();
  });
});
