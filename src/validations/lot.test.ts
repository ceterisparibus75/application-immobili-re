import { describe, it, expect } from "vitest";
import { createLotSchema, updateLotSchema } from "./lot";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validLot = {
  buildingId: VALID_CUID,
  number: "101",
  lotType: "APPARTEMENT" as const,
  area: 55,
};

describe("createLotSchema", () => {
  it("accepte un lot minimal valide", () => {
    expect(createLotSchema.safeParse(validLot).success).toBe(true);
  });

  it("accepte un lot complet", () => {
    const result = createLotSchema.safeParse({
      ...validLot,
      commonShares: 120,
      floor: "3",
      position: "Côté cour",
      description: "Appartement lumineux",
      status: "OCCUPE",
      fiscalRegime: "LMNP_REEL",
      marketRentValue: 950,
      currentRent: 900,
    });
    expect(result.success).toBe(true);
  });

  it("rejette un buildingId non CUID", () => {
    const result = createLotSchema.safeParse({ ...validLot, buildingId: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejette un numéro de lot vide", () => {
    const result = createLotSchema.safeParse({ ...validLot, number: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/numero de lot est requis/);
    }
  });

  it("rejette un numéro de lot trop long (> 50 chars)", () => {
    const result = createLotSchema.safeParse({ ...validLot, number: "N".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejette un lotType invalide", () => {
    const result = createLotSchema.safeParse({ ...validLot, lotType: "MAISON" });
    expect(result.success).toBe(false);
  });

  it("accepte tous les lotType valides", () => {
    const types = [
      "LOCAL_COMMERCIAL", "BUREAUX", "LOCAL_ACTIVITE", "RESERVE",
      "PARKING", "CAVE", "TERRASSE", "ENTREPOT", "APPARTEMENT",
    ];
    for (const lotType of types) {
      expect(createLotSchema.safeParse({ ...validLot, lotType }).success).toBe(true);
    }
  });

  it("rejette une surface négative", () => {
    const result = createLotSchema.safeParse({ ...validLot, area: -10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/positive/);
    }
  });

  it("coerce area depuis une chaîne numérique", () => {
    const result = createLotSchema.safeParse({ ...validLot, area: "75.5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.area).toBe(75.5);
  });

  it("status vaut VACANT par défaut", () => {
    const result = createLotSchema.safeParse(validLot);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("VACANT");
  });

  it("rejette un status invalide", () => {
    const result = createLotSchema.safeParse({ ...validLot, status: "LOUE" });
    expect(result.success).toBe(false);
  });

  it("accepte fiscalRegime vide (chaîne vide)", () => {
    // fiscalRegime peut être "" grâce au .or(z.literal(""))
    const result = createLotSchema.safeParse({ ...validLot, fiscalRegime: "" });
    expect(result.success).toBe(true);
  });

  it("rejette un fiscalRegime invalide non vide", () => {
    const result = createLotSchema.safeParse({ ...validLot, fiscalRegime: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepte commonShares null", () => {
    const result = createLotSchema.safeParse({ ...validLot, commonShares: null });
    expect(result.success).toBe(true);
  });

  it("rejette commonShares non entier", () => {
    const result = createLotSchema.safeParse({ ...validLot, commonShares: 12.5 });
    expect(result.success).toBe(false);
  });
});

describe("updateLotSchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    expect(updateLotSchema.safeParse({ id: VALID_CUID, area: 60 }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateLotSchema.safeParse({ area: 60 }).success).toBe(false);
  });
});
