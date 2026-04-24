import { describe, it, expect } from "vitest";
import { createDataroomSchema, updateDataroomSchema } from "./dataroom";

const validDataroom = {
  name: "Dataroom Immeuble Alpha",
};

describe("createDataroomSchema", () => {
  it("accepte un dataroom minimal valide", () => {
    expect(createDataroomSchema.safeParse(validDataroom).success).toBe(true);
  });

  it("accepte un dataroom complet", () => {
    const result = createDataroomSchema.safeParse({
      ...validDataroom,
      description: "Documents pour due diligence",
      expiresAt: "2025-12-31",
      password: "secret123",
      recipientEmail: "investisseur@example.com",
      recipientName: "M. Dupont",
      purpose: "Cession immeuble",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un nom trop court (< 2 chars)", () => {
    const result = createDataroomSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/min. 2 caractères/);
    }
  });

  it("rejette un nom trop long (> 100 chars)", () => {
    const result = createDataroomSchema.safeParse({ name: "N".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejette une description trop longue (> 1000 chars)", () => {
    const result = createDataroomSchema.safeParse({ ...validDataroom, description: "X".repeat(1001) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Description trop longue/);
    }
  });

  it("rejette un email destinataire invalide", () => {
    const result = createDataroomSchema.safeParse({ ...validDataroom, recipientEmail: "bad@" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Email invalide/);
    }
  });

  it("accepte recipientEmail null", () => {
    const result = createDataroomSchema.safeParse({ ...validDataroom, recipientEmail: null });
    expect(result.success).toBe(true);
  });

  it("accepte password null", () => {
    const result = createDataroomSchema.safeParse({ ...validDataroom, password: null });
    expect(result.success).toBe(true);
  });

  it("rejette un password trop long (> 100 chars)", () => {
    const result = createDataroomSchema.safeParse({ ...validDataroom, password: "X".repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe("updateDataroomSchema", () => {
  it("accepte une mise à jour de statut", () => {
    expect(updateDataroomSchema.safeParse({ status: "ACTIF" }).success).toBe(true);
  });

  it("accepte tous les statuts valides", () => {
    for (const status of ["BROUILLON", "ACTIF", "ARCHIVE"]) {
      expect(updateDataroomSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejette un statut invalide", () => {
    const result = updateDataroomSchema.safeParse({ status: "PUBLIE" });
    expect(result.success).toBe(false);
  });

  it("accepte une mise à jour partielle du nom", () => {
    expect(updateDataroomSchema.safeParse({ name: "Nouveau nom" }).success).toBe(true);
  });

  it("accepte un objet vide (tout optionnel en update)", () => {
    expect(updateDataroomSchema.safeParse({}).success).toBe(true);
  });
});
