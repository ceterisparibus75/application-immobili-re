import { describe, it, expect, vi } from "vitest";

vi.mock("bcryptjs", () => ({ hash: vi.fn().mockResolvedValue("hashed-password") }));
vi.mock("@/lib/email", () => ({
  sendSignupCodeEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { confirmSignup, resendConfirmationCode } from "./confirm-signup";
import { sendSignupCodeEmail } from "@/lib/email";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000); // dans 1h

function makeUser(overrides = {}) {
  return {
    id: "user-1",
    email: "jean@example.com",
    name: "Jean Dupont",
    isActive: false,
    resetToken: "123456",
    resetTokenExpiresAt: FUTURE,
    ...overrides,
  };
}

const validInput = {
  email: "jean@example.com",
  code: "123456",
  password: "SecurePass1",
  confirmPassword: "SecurePass1",
};

describe("confirmSignup", () => {
  it("retourne une erreur si validation Zod échoue (code non numérique)", async () => {
    const result = await confirmSignup({ ...validInput, code: "ABCDEF" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si mot de passe trop court", async () => {
    const result = await confirmSignup({ ...validInput, password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si les mots de passe ne correspondent pas", async () => {
    const result = await confirmSignup({ ...validInput, confirmPassword: "DifferentPass1" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si utilisateur introuvable", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await confirmSignup(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Aucun compte/);
  });

  it("retourne une erreur si le compte est déjà activé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ isActive: true }) as never);
    const result = await confirmSignup(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/déjà activé/);
  });

  it("retourne une erreur si le code de confirmation est invalide", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ resetToken: "999999" }) as never);
    const result = await confirmSignup(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/);
  });

  it("retourne une erreur si le code a expiré", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ resetTokenExpiresAt: new Date(Date.now() - 1000) }) as never
    );
    const result = await confirmSignup(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expiré/);
  });

  it("active le compte avec succès", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as never);
    prismaMock.user.update.mockResolvedValue(makeUser({ isActive: true }) as never);

    const result = await confirmSignup(validInput);
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("jean@example.com");
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: true, resetToken: null }),
      })
    );
  });

  it("normalise l'email en minuscules", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as never);
    prismaMock.user.update.mockResolvedValue(makeUser() as never);

    const result = await confirmSignup({ ...validInput, email: "JEAN@EXAMPLE.COM" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("jean@example.com");
  });

  it("retourne une erreur générique si la BDD échoue dans confirmSignup (lignes 80-81)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as never);
    prismaMock.user.update.mockRejectedValue(new Error("DB error"));
    const result = await confirmSignup(validInput);
    expect(result).toEqual({ success: false, error: "Erreur lors de la confirmation du compte" });
  });
});

describe("resendConfirmationCode", () => {
  it("retourne une erreur si aucun compte en attente", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await resendConfirmationCode("jean@example.com");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/attente/);
  });

  it("retourne une erreur si le compte est déjà activé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ isActive: true }) as never);
    const result = await resendConfirmationCode("jean@example.com");
    expect(result.success).toBe(false);
  });

  it("génère un nouveau code et met à jour l'utilisateur", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as never);
    prismaMock.user.update.mockResolvedValue(makeUser() as never);

    const result = await resendConfirmationCode("jean@example.com");
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("jean@example.com");
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resetToken: expect.any(String) }),
      })
    );
  });

  it("reste en succès si l'envoi d'email échoue (ligne 116 — .catch)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser() as never);
    prismaMock.user.update.mockResolvedValue(makeUser() as never);
    vi.mocked(sendSignupCodeEmail).mockRejectedValueOnce(new Error("SMTP error"));

    const result = await resendConfirmationCode("jean@example.com");
    expect(result.success).toBe(true);
  });

  it("retourne une erreur générique si la BDD échoue dans resendConfirmationCode (lignes 120-121)", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB error"));
    const result = await resendConfirmationCode("jean@example.com");
    expect(result).toEqual({ success: false, error: "Erreur lors du renvoi du code" });
  });
});
