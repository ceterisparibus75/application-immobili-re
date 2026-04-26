import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    PA_AUTH_TOKEN_URL: "https://api.superpdp.tech/oauth2/token",
    PA_AUTH_CLIENT_ID: "client-id",
    PA_AUTH_CLIENT_SECRET: "client-secret",
  },
}));
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace(/^enc:/, "")),
}));

import { prismaMock } from "@/test/mocks/prisma";
import {
  getSocietyAccessToken,
  storeSocietyTokens,
  disconnectSocietyFromSuperPDP,
  cleanupExpiredOAuthStates,
} from "./pa-oauth";

const SOCIETY_ID = "cljhd7fk70000356oa5z7b0js";
const FUTURE = new Date(Date.now() + 3_600_000); // +1h
const PAST   = new Date(Date.now() - 3_600_000); // -1h

describe("getSocietyAccessToken", () => {
  it("retourne null si la société est introuvable", async () => {
    prismaMock.society.findUnique.mockResolvedValue(null);
    expect(await getSocietyAccessToken(SOCIETY_ID)).toBeNull();
  });

  it("retourne null si la société n'a pas de access token", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthAccessToken: null, paOAuthRefreshToken: null, paOAuthTokenExpiresAt: null,
    } as never);
    expect(await getSocietyAccessToken(SOCIETY_ID)).toBeNull();
  });

  it("retourne le token déchiffré si non expiré", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthAccessToken: "enc:valid-access-token",
      paOAuthRefreshToken: null,
      paOAuthTokenExpiresAt: FUTURE,
    } as never);
    expect(await getSocietyAccessToken(SOCIETY_ID)).toBe("valid-access-token");
  });

  it("retourne null si expiré et pas de refresh token — et efface les tokens", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthAccessToken: "enc:expired-token",
      paOAuthRefreshToken: null,
      paOAuthTokenExpiresAt: PAST,
    } as never);
    prismaMock.society.update.mockResolvedValue({} as never);

    expect(await getSocietyAccessToken(SOCIETY_ID)).toBeNull();
    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paOAuthAccessToken: null }),
      })
    );
  });

  it("rafraîchit le token si expiré et refresh disponible", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthAccessToken: "enc:expired-token",
      paOAuthRefreshToken: "enc:refresh-token",
      paOAuthTokenExpiresAt: PAST,
    } as never);
    prismaMock.society.update.mockResolvedValue({} as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      }),
    }));

    const result = await getSocietyAccessToken(SOCIETY_ID);
    expect(result).toBe("new-access-token");
    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paOAuthAccessToken: "enc:new-access-token" }),
      })
    );
    vi.unstubAllGlobals();
  });

  it("efface les tokens et retourne null si le refresh HTTP échoue", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthAccessToken: "enc:expired-token",
      paOAuthRefreshToken: "enc:bad-refresh",
      paOAuthTokenExpiresAt: PAST,
    } as never);
    prismaMock.society.update.mockResolvedValue({} as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    expect(await getSocietyAccessToken(SOCIETY_ID)).toBeNull();
    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paOAuthAccessToken: null }),
      })
    );
    vi.unstubAllGlobals();
  });

  it("conserve l'ancien refresh token si la PA n'en retourne pas de nouveau", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthAccessToken: "enc:expired",
      paOAuthRefreshToken: "enc:old-refresh",
      paOAuthTokenExpiresAt: PAST,
    } as never);
    prismaMock.society.update.mockResolvedValue({} as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "fresh-token", expires_in: 3600 }),
    }));

    await getSocietyAccessToken(SOCIETY_ID);
    const updateCall = prismaMock.society.update.mock.calls[0][0];
    // refresh_token absent dans la réponse → on réutilise l'ancien (déchiffré)
    expect(updateCall?.data?.paOAuthRefreshToken).toBe("enc:old-refresh");
    vi.unstubAllGlobals();
  });
});

describe("storeSocietyTokens", () => {
  it("chiffre et stocke access + refresh token avec expiration", async () => {
    prismaMock.society.update.mockResolvedValue({} as never);

    await storeSocietyTokens(SOCIETY_ID, "at", "rt", 3600);

    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SOCIETY_ID },
        data: expect.objectContaining({
          paOAuthAccessToken: "enc:at",
          paOAuthRefreshToken: "enc:rt",
        }),
      })
    );
  });

  it("stocke null comme refreshToken si non fourni", async () => {
    prismaMock.society.update.mockResolvedValue({} as never);
    await storeSocietyTokens(SOCIETY_ID, "at", undefined, 3600);
    const updateCall = prismaMock.society.update.mock.calls[0][0];
    expect(updateCall?.data?.paOAuthRefreshToken).toBeNull();
  });
});

describe("disconnectSocietyFromSuperPDP", () => {
  beforeEach(() => {
    prismaMock.society.update.mockResolvedValue({} as never);
  });

  it("supprime les tokens sans appel HTTP si aucun refresh token", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthRefreshToken: null, paOAuthAccessToken: null,
    } as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await disconnectSocietyFromSuperPDP(SOCIETY_ID);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prismaMock.society.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paOAuthAccessToken: null }) })
    );
    vi.unstubAllGlobals();
  });

  it("révoque le refresh token via HTTP puis efface localement", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthRefreshToken: "enc:rt", paOAuthAccessToken: "enc:at",
    } as never);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    await disconnectSocietyFromSuperPDP(SOCIETY_ID);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/revoke"),
      expect.objectContaining({ method: "POST" })
    );
    expect(prismaMock.society.update).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("efface localement même si la révocation HTTP échoue (best-effort)", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      paOAuthRefreshToken: "enc:rt", paOAuthAccessToken: "enc:at",
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(disconnectSocietyFromSuperPDP(SOCIETY_ID)).resolves.toBeUndefined();
    expect(prismaMock.society.update).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("cleanupExpiredOAuthStates", () => {
  it("supprime les états PKCE expirés", async () => {
    prismaMock.pAOAuthState.deleteMany.mockResolvedValue({ count: 3 } as never);
    await cleanupExpiredOAuthStates();
    expect(prismaMock.pAOAuthState.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ expiresAt: expect.objectContaining({ lt: expect.any(Date) }) }) })
    );
  });
});
