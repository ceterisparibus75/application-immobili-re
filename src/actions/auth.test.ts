import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/two-factor", () => ({
  verifyTOTP: vi.fn().mockReturnValue(true),
  decryptRecoveryCodes: vi.fn().mockReturnValue([]),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { auth } from "@/lib/auth";
import { verifyTOTP, decryptRecoveryCodes } from "@/lib/two-factor";
import { completeTwoFactorLogin } from "./auth";

function mockAuthWith2FA(requires2FA: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(auth as any).mockResolvedValue({
    user: { id: "user-1", email: "test@example.com" },
    requires2FA,
    twoFactorVerified: false,
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

describe("completeTwoFactorLogin", () => {
  it("retourne une erreur si non authentifié", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValue(null);
    const result = await completeTwoFactorLogin("123456");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si 2FA non requis", async () => {
    mockAuthWith2FA(false);
    const result = await completeTwoFactorLogin("123456");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/non requis/);
  });

  it("retourne une erreur si utilisateur introuvable", async () => {
    mockAuthWith2FA(true);
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await completeTwoFactorLogin("123456");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si pas de secret 2FA configuré", async () => {
    mockAuthWith2FA(true);
    prismaMock.user.findUnique.mockResolvedValue({
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
    } as never);

    const result = await completeTwoFactorLogin("123456");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si code TOTP invalide et pas de code de récupération valide", async () => {
    mockAuthWith2FA(true);
    prismaMock.user.findUnique.mockResolvedValue({
      twoFactorSecret: "encrypted-secret",
      twoFactorRecoveryCodes: ["encrypted-code"],
    } as never);

    vi.mocked(verifyTOTP).mockReturnValueOnce(false);
    vi.mocked(decryptRecoveryCodes).mockReturnValueOnce(["AAAAA-BBBBB"]);

    const result = await completeTwoFactorLogin("000000");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/);
  });

  it("valide avec succès via TOTP", async () => {
    mockAuthWith2FA(true);
    prismaMock.user.findUnique.mockResolvedValue({
      twoFactorSecret: "encrypted-secret",
      twoFactorRecoveryCodes: [],
    } as never);

    vi.mocked(verifyTOTP).mockReturnValueOnce(true);

    const result = await completeTwoFactorLogin("123456");
    expect(result.success).toBe(true);
    expect(result.data?.redirectTo).toBe("/proprietaire");
  });

  it("valide avec un code de récupération et le supprime", async () => {
    mockAuthWith2FA(true);
    prismaMock.user.findUnique.mockResolvedValue({
      twoFactorSecret: "encrypted-secret",
      twoFactorRecoveryCodes: ["encrypted-AAAAA-BBBBB"],
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);

    vi.mocked(verifyTOTP).mockReturnValueOnce(false);
    vi.mocked(decryptRecoveryCodes).mockReturnValueOnce(["AAAAA-BBBBB"]);

    const result = await completeTwoFactorLogin("AAAAA-BBBBB");
    expect(result.success).toBe(true);
    // Le code doit être supprimé de la liste
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { twoFactorRecoveryCodes: [] } })
    );
  });
});
