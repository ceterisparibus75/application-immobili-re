import { describe, it, expect, vi } from "vitest";

const mockCookies = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookies),
}));

vi.mock("@/lib/permissions", () => ({
  requireSocietyAccess: vi.fn().mockResolvedValue({ userId: "user-1", societyId: "society-1", role: "GESTIONNAIRE" }),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = "Forbidden") { super(msg); this.name = "ForbiddenError"; }
  },
}));

import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { getOptionalAccessibleActiveSocietyId } from "./active-society";

const USER_ID = "user-1";
const SOCIETY_ID = "society-1";
const ACCESS = { userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE" as const };

describe("getOptionalAccessibleActiveSocietyId", () => {
  it("retourne null si aucun cookie de société active", async () => {
    mockCookies.get.mockReturnValue(undefined);

    const result = await getOptionalAccessibleActiveSocietyId(USER_ID);
    expect(result).toBeNull();
  });

  it("retourne le societyId si l'utilisateur a accès", async () => {
    mockCookies.get.mockReturnValue({ value: SOCIETY_ID });
    vi.mocked(requireSocietyAccess).mockResolvedValue(ACCESS);

    const result = await getOptionalAccessibleActiveSocietyId(USER_ID);
    expect(result).toBe(SOCIETY_ID);
  });

  it("retourne null si requireSocietyAccess lève ForbiddenError", async () => {
    mockCookies.get.mockReturnValue({ value: SOCIETY_ID });
    vi.mocked(requireSocietyAccess).mockRejectedValue(new ForbiddenError("Accès refusé"));

    const result = await getOptionalAccessibleActiveSocietyId(USER_ID);
    expect(result).toBeNull();
  });

  it("propage les autres erreurs (non-ForbiddenError)", async () => {
    mockCookies.get.mockReturnValue({ value: SOCIETY_ID });
    vi.mocked(requireSocietyAccess).mockRejectedValue(new Error("Erreur DB"));

    await expect(getOptionalAccessibleActiveSocietyId(USER_ID)).rejects.toThrow("Erreur DB");
  });

  it("passe le minRole à requireSocietyAccess", async () => {
    mockCookies.get.mockReturnValue({ value: SOCIETY_ID });
    vi.mocked(requireSocietyAccess).mockResolvedValue(ACCESS);

    await getOptionalAccessibleActiveSocietyId(USER_ID, "GESTIONNAIRE" as never);
    expect(requireSocietyAccess).toHaveBeenCalledWith(USER_ID, SOCIETY_ID, "GESTIONNAIRE");
  });
});
