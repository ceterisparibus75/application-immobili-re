import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/plan-limits", () => ({
  checkSubscriptionActive: vi.fn().mockResolvedValue({ active: true }),
  checkLotLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkSocietyLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getSocietyPlan: vi.fn().mockResolvedValue("PRO"),
  requiresTwoFactor: vi.fn().mockResolvedValue(false),
  checkSignatureFeature: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/two-factor", () => ({
  generateTOTPSecret: vi.fn().mockReturnValue("BASE32SECRET"),
  generateTOTPUri: vi.fn().mockReturnValue("otpauth://totp/..."),
  generateQRCode: vi.fn().mockResolvedValue("data:image/png;base64,..."),
  encryptTOTPSecret: vi.fn().mockReturnValue("encrypted-secret"),
  decryptTOTPSecret: vi.fn().mockReturnValue("BASE32SECRET"),
  generateRecoveryCodes: vi.fn().mockReturnValue(["CODE1-CODE1", "CODE2-CODE2"]),
  encryptRecoveryCodes: vi.fn().mockReturnValue(["encrypted-1", "encrypted-2"]),
}));
vi.mock("bcryptjs", () => ({
  compareSync: vi.fn().mockReturnValue(true),
  hash: vi.fn().mockResolvedValue("hashed"),
}));

const mockTotpValidate = vi.hoisted(() => vi.fn().mockReturnValue(1));
vi.mock("otpauth", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TOTP: vi.fn().mockImplementation(function(this: any) { (this as any).__validate = mockTotpValidate; return { validate: mockTotpValidate }; }),
  Secret: { fromBase32: vi.fn().mockReturnValue("secret-obj") },
}));


import { prismaMock } from "@/test/mocks/prisma";
import { auth } from "@/lib/auth";
import { requiresTwoFactor } from "@/lib/plan-limits";
import { compareSync } from "bcryptjs";
import { initSetupTwoFactor, confirmSetupTwoFactor, disableTwoFactor } from "./two-factor";

function mockAuthUser() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(auth as any).mockResolvedValue({
    user: { id: "user-1", email: "test@example.com" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

describe("initSetupTwoFactor", () => {
  it("retourne une erreur si non authentifié", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValue(null);
    const result = await initSetupTwoFactor();
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si utilisateur introuvable", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await initSetupTwoFactor();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si 2FA déjà activé", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      email: "test@example.com",
      twoFactorEnabled: true,
    } as never);

    const result = await initSetupTwoFactor();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/deja/);
  });

  it("initialise la configuration 2FA avec succès", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      email: "test@example.com",
      twoFactorEnabled: false,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await initSetupTwoFactor();
    expect(result.success).toBe(true);
    expect(result.data?.qrCode).toContain("data:image/png");
    expect(result.data?.secret).toBe("BASE32SECRET");
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pendingTwoFactorSecret: "encrypted-secret" } })
    );
  });
});

describe("confirmSetupTwoFactor", () => {
  it("retourne une erreur si non authentifié", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValue(null);
    const result = await confirmSetupTwoFactor("123456");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si aucun secret en attente", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      pendingTwoFactorSecret: null,
    } as never);

    const result = await confirmSetupTwoFactor("123456");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/attente/);
  });
});

describe("disableTwoFactor", () => {
  it("retourne une erreur si non authentifié", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValue(null);
    const result = await disableTwoFactor("password123");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si utilisateur introuvable", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await disableTwoFactor("password123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si 2FA non activé", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      passwordHash: "hashed",
      twoFactorEnabled: false,
    } as never);

    const result = await disableTwoFactor("password123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/non active/);
  });

  it("retourne une erreur si le plan exige le 2FA", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      passwordHash: "hashed",
      twoFactorEnabled: true,
    } as never);
    vi.mocked(requiresTwoFactor).mockResolvedValueOnce(true);

    const result = await disableTwoFactor("password123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/obligatoire/);
  });

  it("retourne une erreur si le mot de passe est incorrect", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      passwordHash: "hashed",
      twoFactorEnabled: true,
    } as never);
    vi.mocked(compareSync).mockReturnValueOnce(false);

    const result = await disableTwoFactor("wrong-password");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Mot de passe/);
  });

  it("désactive le 2FA avec succès", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      passwordHash: "hashed",
      twoFactorEnabled: true,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    const result = await disableTwoFactor("correct-password");
    expect(result.success).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [] },
      })
    );
  });
});


// ─── initSetupTwoFactor — erreur generique ────────────────────────────────────

describe("initSetupTwoFactor — erreur generique", () => {
  it("retourne une erreur generique si la BDD echoue (lignes 48-49)", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB error"));
    const result = await initSetupTwoFactor();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/initialisation/);
  });
});

// ─── confirmSetupTwoFactor — branches manquantes ──────────────────────────────

describe("confirmSetupTwoFactor — code invalide", () => {
  it("retourne une erreur si le code TOTP est invalide (ligne 76)", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      pendingTwoFactorSecret: "encrypted-pending",
    } as never);
    // simulate invalid TOTP code
    mockTotpValidate.mockReturnValueOnce(null);
    const result = await confirmSetupTwoFactor("000000");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/);
  });

  it("confirme et active le 2FA avec un code valide (lignes 78-101)", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockResolvedValue({
      pendingTwoFactorSecret: "encrypted-pending",
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    const result = await confirmSetupTwoFactor("123456");
    expect(result.success).toBe(true);
    expect(result.data?.recoveryCodes).toEqual(["CODE1-CODE1", "CODE2-CODE2"]);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ twoFactorEnabled: true, pendingTwoFactorSecret: null }),
      })
    );
  });

  it("retourne une erreur generique si la BDD echoue (lignes 103-105)", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB error"));
    const result = await confirmSetupTwoFactor("123456");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/confirmation/);
  });
});

// ─── disableTwoFactor — erreur generique ──────────────────────────────────────

describe("disableTwoFactor — erreur generique", () => {
  it("retourne une erreur generique si la BDD echoue (lignes 151-152)", async () => {
    mockAuthUser();
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB error"));
    const result = await disableTwoFactor("password123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/desactivation/);
  });
});

