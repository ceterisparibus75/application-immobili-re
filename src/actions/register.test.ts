import { describe, it, expect, vi } from "vitest";

vi.mock("bcryptjs", () => ({ hash: vi.fn().mockResolvedValue("hashed-password") }));
vi.mock("@/lib/email", () => ({
  sendSignupCodeEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { registerUser } from "./register";
import { sendSignupCodeEmail } from "@/lib/email";

const validInput = {
  email: "jean@example.com",
  name: "Dupont",
  firstName: "Jean",
  plan: "STARTER" as const,
};

describe("registerUser", () => {
  it("retourne une erreur si validation Zod échoue (email invalide)", async () => {
    const result = await registerUser({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si nom trop court", async () => {
    const result = await registerUser({ ...validInput, name: "D" });
    expect(result.success).toBe(false);
  });

  it("retourne ACCOUNT_EXISTS si le compte actif existe déjà", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "jean@example.com",
      isActive: true,
      resetToken: null,
    } as never);

    const result = await registerUser(validInput);
    expect(result.success).toBe(false);
    expect(result.code).toBe("ACCOUNT_EXISTS");
  });

  it("supprime et recrée si le compte inactif existe avec un token", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "jean@example.com",
      isActive: false,
      resetToken: "123456",
    } as never);
    prismaMock.user.delete.mockResolvedValue({} as never);
    prismaMock.user.create.mockResolvedValue({
      id: "user-2",
      email: "jean@example.com",
    } as never);

    const result = await registerUser(validInput);
    expect(result.success).toBe(true);
    expect(prismaMock.user.delete).toHaveBeenCalled();
    expect(prismaMock.user.create).toHaveBeenCalled();
  });

  it("crée un nouvel utilisateur inactif avec succès", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "user-1",
      email: "jean@example.com",
    } as never);

    const result = await registerUser(validInput);
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("jean@example.com");
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
          resetToken: expect.any(String),
        }),
      })
    );
  });

  it("normalise l'email en minuscules", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "user-1", email: "jean@example.com" } as never);

    const result = await registerUser({ ...validInput, email: "JEAN@EXAMPLE.COM" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("jean@example.com");
  });

  it("envoie l'email de confirmation", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "user-1", email: "jean@example.com" } as never);

    await registerUser(validInput);

    expect(vi.mocked(sendSignupCodeEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jean@example.com" })
    );
  });

  it("utilise le fallback create si la première tentative échoue avec 'Unknown arg'", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create
      .mockRejectedValueOnce(new Error("Unknown arg firstName"))
      .mockResolvedValueOnce({ id: "user-fallback", email: "jean@example.com" } as never);

    const result = await registerUser(validInput);
    expect(result.success).toBe(true);
    expect(prismaMock.user.create).toHaveBeenCalledTimes(2);
  });

  it("retourne ACCOUNT_EXISTS si create propage une Unique constraint", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    // Message sans 'column'/'field'/'Unknown arg' → re-throw de l'inner catch
    prismaMock.user.create.mockRejectedValue(new Error("Unique constraint violation on email"));

    const result = await registerUser(validInput);
    expect(result.success).toBe(false);
    expect(result.code).toBe("ACCOUNT_EXISTS");
  });

  it("retourne une erreur générique si create lève une autre exception", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockRejectedValue(new Error("Connection timeout"));

    const result = await registerUser(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Connection timeout");
  });

  it("create lance une chaîne de caractères — branches false de instanceof (lignes 78 et 105)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockRejectedValue("string error non-Error");

    const result = await registerUser(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("string error non-Error");
  });

  it("continue avec succès même si l'envoi d'email échoue", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "user-1", email: "jean@example.com" } as never);
    vi.mocked(sendSignupCodeEmail).mockRejectedValueOnce(new Error("SMTP error"));

    const result = await registerUser(validInput);
    expect(result.success).toBe(true);
  });
});
