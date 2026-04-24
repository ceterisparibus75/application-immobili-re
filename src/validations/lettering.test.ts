import { describe, it, expect } from "vitest";
import { letterEntriesSchema, unletterEntriesSchema, getUnletteredEntriesSchema } from "./lettering";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3u";

describe("letterEntriesSchema", () => {
  it("accepte un groupe de 2 lignes valides", () => {
    const result = letterEntriesSchema.safeParse({ lineIds: [VALID_CUID, VALID_CUID_2] });
    expect(result.success).toBe(true);
  });

  it("rejette si moins de 2 lignes", () => {
    const result = letterEntriesSchema.safeParse({ lineIds: [VALID_CUID] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/au moins 2 lignes/);
    }
  });

  it("rejette si tableau vide", () => {
    const result = letterEntriesSchema.safeParse({ lineIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejette si plus de 100 lignes", () => {
    const manyIds = Array.from({ length: 101 }, () => VALID_CUID);
    const result = letterEntriesSchema.safeParse({ lineIds: manyIds });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Maximum 100 lignes/);
    }
  });

  it("accepte exactement 100 lignes (limite maximale)", () => {
    const ids = Array.from({ length: 100 }, () => VALID_CUID);
    const result = letterEntriesSchema.safeParse({ lineIds: ids });
    expect(result.success).toBe(true);
  });

  it("rejette un ID non CUID dans la liste", () => {
    const result = letterEntriesSchema.safeParse({ lineIds: [VALID_CUID, "not-a-cuid"] });
    expect(result.success).toBe(false);
  });
});

describe("unletterEntriesSchema", () => {
  it("accepte un code de lettrage valide à 2 lettres majuscules", () => {
    expect(unletterEntriesSchema.safeParse({ letteringCode: "AA" }).success).toBe(true);
  });

  it("accepte un code de lettrage valide à 4 lettres majuscules", () => {
    expect(unletterEntriesSchema.safeParse({ letteringCode: "ABCD" }).success).toBe(true);
  });

  it("rejette un code de 1 caractère (trop court)", () => {
    const result = unletterEntriesSchema.safeParse({ letteringCode: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/au moins 2 caracteres/);
    }
  });

  it("rejette un code de 5 caractères (trop long)", () => {
    const result = unletterEntriesSchema.safeParse({ letteringCode: "ABCDE" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/depasser 4 caracteres/);
    }
  });

  it("rejette un code avec des minuscules", () => {
    const result = unletterEntriesSchema.safeParse({ letteringCode: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/lettres majuscules/);
    }
  });

  it("rejette un code avec des chiffres", () => {
    const result = unletterEntriesSchema.safeParse({ letteringCode: "A1" });
    expect(result.success).toBe(false);
  });

  it("rejette un code vide", () => {
    const result = unletterEntriesSchema.safeParse({ letteringCode: "" });
    expect(result.success).toBe(false);
  });
});

describe("getUnletteredEntriesSchema", () => {
  it("accepte un accountId CUID valide", () => {
    expect(getUnletteredEntriesSchema.safeParse({ accountId: VALID_CUID }).success).toBe(true);
  });

  it("rejette un accountId non CUID", () => {
    expect(getUnletteredEntriesSchema.safeParse({ accountId: "not-a-cuid" }).success).toBe(false);
  });
});
