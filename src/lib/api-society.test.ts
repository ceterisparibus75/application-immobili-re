import { describe, it, expect, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());
const requireSocietyAccessMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/permissions", () => ({
  requireSocietyAccess: requireSocietyAccessMock,
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = "Accès refusé") {
      super(msg);
      this.name = "ForbiddenError";
    }
  },
}));

import { requireActiveSocietyRouteContext } from "./api-society";
import { ForbiddenError } from "@/lib/permissions";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

function makeCookieStore(societyId: string | null) {
  return {
    get: (key: string) => (key === "active-society-id" && societyId ? { value: societyId } : undefined),
  };
}

describe("requireActiveSocietyRouteContext", () => {
  it("retourne le contexte si authentifié et société trouvée en cookie", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    cookiesMock.mockResolvedValue(makeCookieStore(SOCIETY_ID));
    requireSocietyAccessMock.mockResolvedValue(undefined);

    const result = await requireActiveSocietyRouteContext();

    expect(result).toEqual({ userId: "user-123", societyId: SOCIETY_ID });
  });

  it("retourne 401 si non authentifié", async () => {
    authMock.mockResolvedValue(null);
    cookiesMock.mockResolvedValue(makeCookieStore(SOCIETY_ID));

    const result = await requireActiveSocietyRouteContext();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("retourne 400 si pas de societyId en cookie", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    cookiesMock.mockResolvedValue(makeCookieStore(null));

    const result = await requireActiveSocietyRouteContext();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
    const body = await (result as Response).json();
    expect(body.error).toMatch(/Société non sélectionnée/);
  });

  it("utilise societyId passé en option plutôt que le cookie", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    cookiesMock.mockResolvedValue(makeCookieStore("cookie-society"));
    requireSocietyAccessMock.mockResolvedValue(undefined);

    const result = await requireActiveSocietyRouteContext({ societyId: SOCIETY_ID });

    expect(result).toEqual({ userId: "user-123", societyId: SOCIETY_ID });
    expect(requireSocietyAccessMock).toHaveBeenCalledWith("user-123", SOCIETY_ID, undefined);
  });

  it("retourne 403 si ForbiddenError de requireSocietyAccess", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    cookiesMock.mockResolvedValue(makeCookieStore(SOCIETY_ID));
    requireSocietyAccessMock.mockRejectedValue(new ForbiddenError("Accès refusé"));

    const result = await requireActiveSocietyRouteContext();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("passe minRole à requireSocietyAccess", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    cookiesMock.mockResolvedValue(makeCookieStore(SOCIETY_ID));
    requireSocietyAccessMock.mockResolvedValue(undefined);

    await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });

    expect(requireSocietyAccessMock).toHaveBeenCalledWith("user-123", SOCIETY_ID, "GESTIONNAIRE");
  });

  it("propage les erreurs non-ForbiddenError", async () => {
    authMock.mockResolvedValue({ user: { id: "user-123" } });
    cookiesMock.mockResolvedValue(makeCookieStore(SOCIETY_ID));
    requireSocietyAccessMock.mockRejectedValue(new Error("DB error"));

    await expect(requireActiveSocietyRouteContext()).rejects.toThrow("DB error");
  });
});
