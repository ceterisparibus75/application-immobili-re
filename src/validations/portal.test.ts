import { describe, it, expect } from "vitest";
import { portalActivateSchema, portalLoginRequestSchema, portalLoginVerifySchema } from "./portal";

describe("portalLoginRequestSchema", () => {
  it("accepte un email valide", () => {
    const result = portalLoginRequestSchema.safeParse({ email: "alice@example.com" });
    expect(result.success).toBe(true);
  });

  it("transforme l'email en minuscules", () => {
    const result = portalLoginRequestSchema.safeParse({ email: "ALICE@EXAMPLE.COM" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("alice@example.com");
  });

  it("rejette un email invalide", () => {
    const result = portalLoginRequestSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Email invalide/);
    }
  });

  it("rejette un email vide", () => {
    const result = portalLoginRequestSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

describe("portalActivateSchema", () => {
  it("accepte un email et un code valides", () => {
    const result = portalActivateSchema.safeParse({ email: "alice@example.com", code: "123456" });
    expect(result.success).toBe(true);
  });

  it("transforme l'email en minuscules", () => {
    const result = portalActivateSchema.safeParse({ email: "ALICE@EXAMPLE.COM", code: "123456" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("alice@example.com");
  });

  it("rejette un code de moins de 6 chiffres", () => {
    const result = portalActivateSchema.safeParse({ email: "alice@example.com", code: "12345" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/6 chiffres/);
    }
  });

  it("rejette un code de plus de 6 chiffres", () => {
    const result = portalActivateSchema.safeParse({ email: "alice@example.com", code: "1234567" });
    expect(result.success).toBe(false);
  });

  it("rejette un code contenant des lettres", () => {
    const result = portalActivateSchema.safeParse({ email: "alice@example.com", code: "12345A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/chiffres uniquement/);
    }
  });

  it("rejette un code vide", () => {
    const result = portalActivateSchema.safeParse({ email: "alice@example.com", code: "" });
    expect(result.success).toBe(false);
  });

  it("accepte le code '000000' (tout zéros)", () => {
    const result = portalActivateSchema.safeParse({ email: "alice@example.com", code: "000000" });
    expect(result.success).toBe(true);
  });
});

describe("portalLoginVerifySchema", () => {
  it("accepte des données valides", () => {
    const result = portalLoginVerifySchema.safeParse({ email: "alice@example.com", code: "654321" });
    expect(result.success).toBe(true);
  });

  it("transforme l'email en minuscules", () => {
    const result = portalLoginVerifySchema.safeParse({ email: "Alice@Example.COM", code: "123456" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("alice@example.com");
  });

  it("rejette un code avec des espaces", () => {
    const result = portalLoginVerifySchema.safeParse({ email: "alice@example.com", code: "123 56" });
    expect(result.success).toBe(false);
  });
});
