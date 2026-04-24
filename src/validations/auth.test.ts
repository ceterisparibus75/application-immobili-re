import { describe, it, expect } from "vitest";
import { strongPasswordSchema } from "./auth";

describe("strongPasswordSchema", () => {
  it("accepte un mot de passe fort valide", () => {
    const result = strongPasswordSchema.safeParse("MyP@ssw0rd2024!");
    expect(result.success).toBe(true);
  });

  it("rejette un mot de passe trop court (< 12 chars)", () => {
    const result = strongPasswordSchema.safeParse("Short1!Ab");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/12/);
    }
  });

  it("rejette un mot de passe sans majuscule", () => {
    const result = strongPasswordSchema.safeParse("nouppercase1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("majuscule"))).toBe(true);
    }
  });

  it("rejette un mot de passe sans minuscule", () => {
    const result = strongPasswordSchema.safeParse("NOLOWERCASE1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("minuscule"))).toBe(true);
    }
  });

  it("rejette un mot de passe sans chiffre", () => {
    const result = strongPasswordSchema.safeParse("NoDigitHere!!");
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("chiffre"))).toBe(true);
    }
  });

  it("rejette un mot de passe sans caractère spécial", () => {
    const result = strongPasswordSchema.safeParse("NoSpecialChar1");
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("special"))).toBe(true);
    }
  });

  it("rejette un mot de passe de la liste noire (Password1)", () => {
    const result = strongPasswordSchema.safeParse("Password1");
    expect(result.success).toBe(false);
  });

  it("rejette 'Pa$$word1' (trop court + liste noire)", () => {
    // Pa$$word1 = 9 chars → rejeté pour longueur (< 12)
    const result = strongPasswordSchema.safeParse("Pa$$word1");
    expect(result.success).toBe(false);
  });

  it("rejette 'Azerty123!' (liste noire)", () => {
    const result = strongPasswordSchema.safeParse("Azerty123!");
    expect(result.success).toBe(false);
  });

  it("accepte un mot de passe long complexe hors liste noire", () => {
    const result = strongPasswordSchema.safeParse("Immo#Gest1on2024$Secure");
    expect(result.success).toBe(true);
  });

  it("accepte un mot de passe avec accents et caractères Unicode", () => {
    // Les accents sont des caractères non-alphanumériques → satisfait la règle spéciale
    const result = strongPasswordSchema.safeParse("Gest1on#Immo2024é");
    expect(result.success).toBe(true);
  });

  it("rejette une chaîne vide", () => {
    const result = strongPasswordSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});
