import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted"),
  decrypt: vi.fn().mockReturnValue("decrypted"),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { auth } from "@/lib/auth";
import { checkSocietyLimit } from "@/lib/plan-limits";
import { createSociety, updateSociety, getSocieties, getSocietyById, deleteSociety } from "./society";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

const validCreateInput = {
  name: "Ma SCI",
  legalForm: "SCI" as const,
  addressLine1: "10 rue de la Paix",
  city: "Paris",
  postalCode: "75001",
  country: "France",
  taxRegime: "IS" as const,
  vatRegime: "TVA" as const,
};

function mockAuthUser() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(auth as any).mockResolvedValue({
    user: { id: "user-1", email: "test@example.com", name: "Test User" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

function makeSociety(overrides = {}) {
  return {
    id: SOCIETY_ID,
    name: "Ma SCI",
    legalForm: "SCI",
    siret: null,
    city: "Paris",
    isActive: true,
    logoUrl: null,
    ownerId: "user-1",
    proprietaire: null,
    ...overrides,
  };
}

describe("createSociety", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createSociety(validCreateInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue (nom trop court)", async () => {
    mockAuthUser();
    const result = await createSociety({ ...validCreateInput, name: "X" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si limite de sociétés atteinte", async () => {
    mockAuthUser();
    vi.mocked(checkSocietyLimit).mockResolvedValueOnce({ allowed: false, message: "Limite atteinte" });
    const result = await createSociety(validCreateInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Limite/);
  });

  it("retourne une erreur si SIRET déjà enregistré", async () => {
    mockAuthUser();
    prismaMock.society.findUnique.mockResolvedValue(makeSociety({ siret: "12345678901234" }) as never);
    const result = await createSociety({ ...validCreateInput, siret: "12345678901234" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/SIRET/);
  });

  it("crée la société avec succès", async () => {
    mockAuthUser();
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.society.create.mockResolvedValue(makeSociety() as never);
    prismaMock.userSociety.create.mockResolvedValue({} as never);
    prismaMock.subscription.create.mockResolvedValue({} as never);

    const result = await createSociety(validCreateInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(SOCIETY_ID);
    expect(prismaMock.userSociety.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN_SOCIETE" }) })
    );
    expect(prismaMock.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ planId: "STARTER", status: "TRIALING" }) })
    );
  });

  it("chiffre l'IBAN si fourni", async () => {
    mockAuthUser();
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.society.create.mockResolvedValue(makeSociety() as never);
    prismaMock.userSociety.create.mockResolvedValue({} as never);
    prismaMock.subscription.create.mockResolvedValue({} as never);

    await createSociety({ ...validCreateInput, iban: "FR7630006000011234567890189" });

    const { encrypt } = await import("@/lib/encryption");
    expect(vi.mocked(encrypt)).toHaveBeenCalledWith("FR7630006000011234567890189");
  });

  it("continue si le SIRET est unique (if existing arm1 — ligne 56)", async () => {
    mockAuthUser();
    prismaMock.society.findUnique.mockResolvedValue(null); // SIRET unique
    prismaMock.society.create.mockResolvedValue(makeSociety() as never);
    prismaMock.userSociety.create.mockResolvedValue({} as never);
    prismaMock.subscription.create.mockResolvedValue({} as never);
    const result = await createSociety({ ...validCreateInput, siret: "12345678901234" });
    expect(result.success).toBe(true);
  });

  it("chiffre le BIC si fourni (data.bic arm0 — ligne 63)", async () => {
    mockAuthUser();
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.society.create.mockResolvedValue(makeSociety() as never);
    prismaMock.userSociety.create.mockResolvedValue({} as never);
    prismaMock.subscription.create.mockResolvedValue({} as never);
    await createSociety({ ...validCreateInput, bic: "BNPAFRPP" });
    const { encrypt } = await import("@/lib/encryption");
    expect(vi.mocked(encrypt)).toHaveBeenCalledWith("BNPAFRPP");
  });

  it("retourne une erreur générique si la BDD échoue dans createSociety (lignes 136-137)", async () => {
    mockAuthUser();
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.society.create.mockRejectedValue(new Error("DB error"));
    const result = await createSociety(validCreateInput);
    expect(result).toEqual({ success: false, error: "Erreur lors de la création de la société" });
  });
});

describe("updateSociety", () => {
  it("retourne une erreur si validation Zod échoue (id manquant)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await updateSociety({ name: "Test" } as any);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await updateSociety({ id: SOCIETY_ID, name: "Nouveau nom" });
    expect(result.success).toBe(false);
  });

  it("met à jour la société avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.society.update.mockResolvedValue(makeSociety({ name: "Nouveau nom" }) as never);

    const result = await updateSociety({ id: SOCIETY_ID, name: "Nouveau nom" });
    expect(result.success).toBe(true);
    expect(prismaMock.society.update).toHaveBeenCalled();
  });

  it("convertit IBAN et BIC vides en null (lignes 161, 164)", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.society.update.mockResolvedValue(makeSociety() as never);

    await updateSociety({ id: SOCIETY_ID, iban: "", bic: "" });
    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ibanEncrypted: null, bicEncrypted: null }),
      })
    );
  });

  it("chiffre IBAN et BIC non vides dans updateSociety (arm0 lignes 161, 164)", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.society.update.mockResolvedValue(makeSociety() as never);
    await updateSociety({ id: SOCIETY_ID, iban: "FR7630006000011234567890189", bic: "BNPAFRPP" });
    const { encrypt } = await import("@/lib/encryption");
    expect(vi.mocked(encrypt)).toHaveBeenCalledWith("FR7630006000011234567890189");
    expect(vi.mocked(encrypt)).toHaveBeenCalledWith("BNPAFRPP");
  });

  it("retourne ForbiddenError si rôle insuffisant pour updateSociety (lignes 199-200)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await updateSociety({ id: SOCIETY_ID, name: "Test" });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur générique si la BDD échoue dans updateSociety (lignes 202-203)", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.society.update.mockRejectedValue(new Error("DB error"));
    const result = await updateSociety({ id: SOCIETY_ID, name: "Test" });
    expect(result).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });

  it("convertit les chaînes vides en null", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.society.update.mockResolvedValue(makeSociety() as never);

    await updateSociety({ id: SOCIETY_ID, phone: "" });
    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: null }) })
    );
  });
});

describe("getSocieties", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getSocieties();
    expect(result).toEqual([]);
  });

  it("retourne les sociétés via les memberships", async () => {
    mockAuthUser();
    prismaMock.userSociety.findMany.mockResolvedValue([
      { societyId: SOCIETY_ID, role: "GESTIONNAIRE", society: makeSociety() },
    ] as never);
    prismaMock.society.findMany.mockResolvedValue([] as never);

    const result = await getSocieties();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Ma SCI");
    expect(result[0].role).toBe("GESTIONNAIRE");
  });

  it("inclut les sociétés dont l'utilisateur est propriétaire sans membership", async () => {
    mockAuthUser();
    prismaMock.userSociety.findMany.mockResolvedValue([] as never);
    prismaMock.society.findMany.mockResolvedValue([makeSociety()] as never);

    const result = await getSocieties();
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("ADMIN_SOCIETE");
  });

  it("combine memberships et sociétés propres", async () => {
    mockAuthUser();
    prismaMock.userSociety.findMany.mockResolvedValue([
      { societyId: SOCIETY_ID, role: "GESTIONNAIRE", society: makeSociety() },
    ] as never);
    prismaMock.society.findMany.mockResolvedValue([
      makeSociety({ id: "other-society", name: "Autre SCI" }),
    ] as never);

    const result = await getSocieties();
    expect(result).toHaveLength(2);
  });
});

describe("getSocietyById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getSocietyById(SOCIETY_ID);
    expect(result).toBeNull();
  });

  it("retourne la société si trouvée", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.society.findUnique.mockResolvedValue(makeSociety() as never);

    const result = await getSocietyById(SOCIETY_ID);
    expect(result?.id).toBe(SOCIETY_ID);
  });
});

describe("deleteSociety – erreurs supplémentaires", () => {
  it("retourne une erreur générique si la BDD échoue dans deleteSociety (lignes 319-320)", async () => {
    mockAuthSession("SUPER_ADMIN", SOCIETY_ID);
    prismaMock.lease.count.mockRejectedValue(new Error("DB error"));
    const result = await deleteSociety(SOCIETY_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });
});

describe("deleteSociety", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteSociety(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si permissions insuffisantes", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await deleteSociety(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Permissions/);
  });

  it("retourne une erreur si baux actifs", async () => {
    mockAuthSession("SUPER_ADMIN", SOCIETY_ID);
    prismaMock.lease.count.mockResolvedValue(2 as never);

    const result = await deleteSociety(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bail/);
  });

  it("supprime (soft delete) la société avec succès", async () => {
    mockAuthSession("SUPER_ADMIN", SOCIETY_ID);
    prismaMock.lease.count.mockResolvedValue(0 as never);
    prismaMock.society.update.mockResolvedValue(makeSociety({ isActive: false }) as never);

    const result = await deleteSociety(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });
});
