import { describe, it, expect } from "vitest";
import {
  importTenantRowSchema,
  importBuildingRowSchema,
  importLotRowSchema,
  importEntityTypeSchema,
} from "./import";

describe("importTenantRowSchema", () => {
  const validTenant = {
    nom: "Martin",
    prenom: "Alice",
    email: "alice@example.com",
  };

  it("accepte une ligne locataire valide", () => {
    expect(importTenantRowSchema.safeParse(validTenant).success).toBe(true);
  });

  it("telephone vaut chaîne vide par défaut", () => {
    const result = importTenantRowSchema.safeParse(validTenant);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.telephone).toBe("");
  });

  it("rejette nom vide", () => {
    const result = importTenantRowSchema.safeParse({ ...validTenant, nom: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/nom est requis/);
    }
  });

  it("rejette prenom vide", () => {
    const result = importTenantRowSchema.safeParse({ ...validTenant, prenom: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/prenom est requis/);
    }
  });

  it("rejette un email invalide", () => {
    const result = importTenantRowSchema.safeParse({ ...validTenant, email: "bad@" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Email invalide/);
    }
  });

  it("accepte un téléphone fourni", () => {
    const result = importTenantRowSchema.safeParse({ ...validTenant, telephone: "0612345678" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.telephone).toBe("0612345678");
  });
});

describe("importBuildingRowSchema", () => {
  const validBuilding = {
    name: "Résidence Les Pins",
    address: "12 rue de la Paix",
    postalCode: "75001",
    city: "Paris",
  };

  it("accepte une ligne immeuble valide", () => {
    expect(importBuildingRowSchema.safeParse(validBuilding).success).toBe(true);
  });

  it("type vaut MIXTE par défaut", () => {
    const result = importBuildingRowSchema.safeParse(validBuilding);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("MIXTE");
  });

  it("rejette un nom trop court (< 2 chars)", () => {
    const result = importBuildingRowSchema.safeParse({ ...validBuilding, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2 caracteres/);
    }
  });

  it("rejette un code postal invalide (pas 5 chiffres)", () => {
    const result = importBuildingRowSchema.safeParse({ ...validBuilding, postalCode: "7500" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Code postal invalide/);
    }
  });

  it("rejette une adresse trop courte (< 5 chars)", () => {
    const result = importBuildingRowSchema.safeParse({ ...validBuilding, address: "Rue" });
    expect(result.success).toBe(false);
  });

  it("accepte tous les types d'immeuble valides", () => {
    for (const type of ["BUREAU", "COMMERCE", "MIXTE", "ENTREPOT"]) {
      expect(importBuildingRowSchema.safeParse({ ...validBuilding, type }).success).toBe(true);
    }
  });

  it("rejette un type invalide", () => {
    const result = importBuildingRowSchema.safeParse({ ...validBuilding, type: "MAISON" });
    expect(result.success).toBe(false);
  });
});

describe("importLotRowSchema", () => {
  const validLot = {
    reference: "LOT-101",
    surface: 55,
    buildingId: "imm-001",
  };

  it("accepte une ligne lot valide", () => {
    expect(importLotRowSchema.safeParse(validLot).success).toBe(true);
  });

  it("type vaut BUREAUX par défaut", () => {
    const result = importLotRowSchema.safeParse(validLot);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("BUREAUX");
  });

  it("etage vaut chaîne vide par défaut", () => {
    const result = importLotRowSchema.safeParse(validLot);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.etage).toBe("");
  });

  it("rejette reference vide", () => {
    const result = importLotRowSchema.safeParse({ ...validLot, reference: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/reference du lot est requise/);
    }
  });

  it("rejette surface négative", () => {
    const result = importLotRowSchema.safeParse({ ...validLot, surface: -10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/positive/);
    }
  });

  it("coerce surface depuis une chaîne", () => {
    const result = importLotRowSchema.safeParse({ ...validLot, surface: "75.5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.surface).toBe(75.5);
  });

  it("rejette buildingId vide", () => {
    const result = importLotRowSchema.safeParse({ ...validLot, buildingId: "" });
    expect(result.success).toBe(false);
  });
});

describe("importEntityTypeSchema", () => {
  it("accepte 'tenants'", () => {
    expect(importEntityTypeSchema.safeParse("tenants").success).toBe(true);
  });

  it("accepte 'lots'", () => {
    expect(importEntityTypeSchema.safeParse("lots").success).toBe(true);
  });

  it("accepte 'buildings'", () => {
    expect(importEntityTypeSchema.safeParse("buildings").success).toBe(true);
  });

  it("rejette un type inconnu", () => {
    expect(importEntityTypeSchema.safeParse("contacts").success).toBe(false);
  });
});
