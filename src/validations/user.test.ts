import { describe, it, expect } from "vitest";
import {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  assignUserToSocietySchema,
  changePasswordSchema,
  updateModulePermissionsSchema,
} from "./user";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3u";
const STRONG_PASSWORD = "MySecure#Pass2024!";

describe("loginSchema", () => {
  it("accepte des identifiants valides", () => {
    expect(loginSchema.safeParse({ email: "alice@example.com", password: "anyPassword" }).success).toBe(true);
  });

  it("rejette un email invalide", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "pwd" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/email invalide/i);
    }
  });

  it("rejette un mot de passe vide", () => {
    const result = loginSchema.safeParse({ email: "alice@example.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/mot de passe est requis/);
    }
  });
});

describe("createUserSchema", () => {
  it("accepte un utilisateur valide", () => {
    expect(createUserSchema.safeParse({ email: "bob@example.com", name: "Bob Martin" }).success).toBe(true);
  });

  it("rejette un nom trop court (< 2 chars)", () => {
    const result = createUserSchema.safeParse({ email: "bob@example.com", name: "B" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2 caractères/);
    }
  });

  it("accepte firstName comme chaîne vide", () => {
    const result = createUserSchema.safeParse({ email: "bob@example.com", name: "Bob", firstName: "" });
    expect(result.success).toBe(true);
  });
});

describe("updateUserSchema", () => {
  it("accepte une mise à jour valide", () => {
    expect(updateUserSchema.safeParse({ id: VALID_CUID, name: "Alice Martin" }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateUserSchema.safeParse({ name: "Alice" }).success).toBe(false);
  });

  it("accepte isActive boolean", () => {
    expect(updateUserSchema.safeParse({ id: VALID_CUID, isActive: false }).success).toBe(true);
  });

  it("rejette un email invalide", () => {
    const result = updateUserSchema.safeParse({ id: VALID_CUID, email: "bad@" });
    expect(result.success).toBe(false);
  });
});

describe("assignUserToSocietySchema", () => {
  const validAssign = {
    userId: VALID_CUID,
    societyId: VALID_CUID_2,
    role: "GESTIONNAIRE" as const,
  };

  it("accepte une assignation valide", () => {
    expect(assignUserToSocietySchema.safeParse(validAssign).success).toBe(true);
  });

  it("rejette un rôle invalide", () => {
    const result = assignUserToSocietySchema.safeParse({ ...validAssign, role: "INVITE" });
    expect(result.success).toBe(false);
  });

  it("accepte tous les rôles valides", () => {
    const roles = ["SUPER_ADMIN", "ADMIN_SOCIETE", "GESTIONNAIRE", "COMPTABLE", "LECTURE"];
    for (const role of roles) {
      expect(assignUserToSocietySchema.safeParse({ ...validAssign, role }).success).toBe(true);
    }
  });
});

describe("changePasswordSchema", () => {
  const validChange = {
    currentPassword: "ancienMdp!",
    newPassword: STRONG_PASSWORD,
    confirmPassword: STRONG_PASSWORD,
  };

  it("accepte un changement de mot de passe valide", () => {
    expect(changePasswordSchema.safeParse(validChange).success).toBe(true);
  });

  it("rejette si currentPassword est vide", () => {
    const result = changePasswordSchema.safeParse({ ...validChange, currentPassword: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/mot de passe actuel est requis/);
    }
  });

  it("rejette si confirmPassword ne correspond pas", () => {
    const result = changePasswordSchema.safeParse({ ...validChange, confirmPassword: "AutreMdp#2024!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("correspondent pas"))).toBe(true);
    }
  });

  it("rejette un newPassword faible (< 12 chars)", () => {
    const result = changePasswordSchema.safeParse({
      ...validChange,
      newPassword: "Short1!",
      confirmPassword: "Short1!",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateModulePermissionsSchema", () => {
  it("accepte des permissions valides", () => {
    const result = updateModulePermissionsSchema.safeParse({
      userId: VALID_CUID,
      societyId: VALID_CUID_2,
      modulePermissions: {
        patrimoine: ["read", "write"],
        facturation: ["read"],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejette un module inconnu", () => {
    const result = updateModulePermissionsSchema.safeParse({
      userId: VALID_CUID,
      societyId: VALID_CUID_2,
      modulePermissions: { inconnu: ["read"] },
    });
    expect(result.success).toBe(false);
  });

  it("rejette une permission invalide", () => {
    const result = updateModulePermissionsSchema.safeParse({
      userId: VALID_CUID,
      societyId: VALID_CUID_2,
      modulePermissions: { patrimoine: ["admin"] },
    });
    expect(result.success).toBe(false);
  });

  it("rejette userId non CUID", () => {
    const result = updateModulePermissionsSchema.safeParse({
      userId: "bad",
      societyId: VALID_CUID_2,
      modulePermissions: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/ID utilisateur invalide/);
    }
  });
});
