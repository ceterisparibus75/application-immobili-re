import { describe, it, expect, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requireSocietyAccessMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/permissions", () => ({
  requireSocietyAccess: requireSocietyAccessMock,
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = "Accès refusé") {
      super(msg);
      this.name = "ForbiddenError";
    }
  },
}));

import {
  UnauthenticatedActionError,
  requireSocietyActionContext,
  getOptionalSocietyActionContext,
} from "./action-society";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("UnauthenticatedActionError", () => {
  it("a le bon nom et message par défaut", () => {
    const err = new UnauthenticatedActionError();
    expect(err.name).toBe("UnauthenticatedActionError");
    expect(err.message).toBe("Non authentifié");
  });

  it("accepte un message personnalisé", () => {
    const err = new UnauthenticatedActionError("Session expirée");
    expect(err.message).toBe("Session expirée");
  });
});

describe("requireSocietyActionContext", () => {
  it("retourne le contexte si authentifié et accès accordé", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    requireSocietyAccessMock.mockResolvedValue(undefined);

    const ctx = await requireSocietyActionContext(SOCIETY_ID);

    expect(ctx.userId).toBe("user-123");
    expect(ctx.societyId).toBe(SOCIETY_ID);
    expect(requireSocietyAccessMock).toHaveBeenCalledWith("user-123", SOCIETY_ID, undefined);
  });

  it("passe le minRole à requireSocietyAccess", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    requireSocietyAccessMock.mockResolvedValue(undefined);

    await requireSocietyActionContext(SOCIETY_ID, "GESTIONNAIRE");

    expect(requireSocietyAccessMock).toHaveBeenCalledWith("user-123", SOCIETY_ID, "GESTIONNAIRE");
  });

  it("lève UnauthenticatedActionError si non authentifié", async () => {
    authMock.mockResolvedValue(null);

    await expect(requireSocietyActionContext(SOCIETY_ID)).rejects.toThrow(UnauthenticatedActionError);
  });

  it("propage l'erreur si requireSocietyAccess échoue", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    requireSocietyAccessMock.mockRejectedValue(new Error("Accès refusé"));

    await expect(requireSocietyActionContext(SOCIETY_ID)).rejects.toThrow("Accès refusé");
  });
});

describe("getOptionalSocietyActionContext", () => {
  it("retourne le contexte si authentifié et accès accordé", async () => {
    authMock.mockResolvedValue({ user: { id: "user-456" } });
    requireSocietyAccessMock.mockResolvedValue(undefined);

    const ctx = await getOptionalSocietyActionContext(SOCIETY_ID);

    expect(ctx).not.toBeNull();
    expect(ctx!.userId).toBe("user-456");
    expect(ctx!.societyId).toBe(SOCIETY_ID);
  });

  it("retourne null si non authentifié", async () => {
    authMock.mockResolvedValue(null);

    const ctx = await getOptionalSocietyActionContext(SOCIETY_ID);
    expect(ctx).toBeNull();
  });

  it("retourne null si requireSocietyAccess échoue (accès refusé)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-789" } });
    requireSocietyAccessMock.mockRejectedValue(new Error("forbidden"));

    const ctx = await getOptionalSocietyActionContext(SOCIETY_ID);
    expect(ctx).toBeNull();
  });
});
