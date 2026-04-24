import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

const cookieStoreMock = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(cookieStoreMock),
}));

import { createPortalSession, getPortalSession, requirePortalAuth, clearPortalSession } from "./portal-auth";

const AUTH_SECRET = "test-auth-secret-at-least-32-chars!!";

async function makeToken(payload: Record<string, unknown>, secret = AUTH_SECRET): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("portal")
    .setExpirationTime("24h")
    .sign(new TextEncoder().encode(secret));
}

describe("portal-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = AUTH_SECRET;
  });

  // ── createPortalSession ──────────────────────────────────────────────────
  describe("createPortalSession", () => {
    it("appelle cookieStore.set avec portal-token", async () => {
      await createPortalSession("tenant-1", "alice@example.com");
      expect(cookieStoreMock.set).toHaveBeenCalledOnce();
      expect(cookieStoreMock.set.mock.calls[0][0]).toBe("portal-token");
    });

    it("stocke un JWT signé (3 segments séparés par .)", async () => {
      await createPortalSession("tenant-1", "alice@example.com");
      const token = cookieStoreMock.set.mock.calls[0][1] as string;
      expect(token.split(".")).toHaveLength(3);
    });

    it("normalise l'email en minuscules dans le payload", async () => {
      await createPortalSession("tenant-1", "ALICE@EXAMPLE.COM");
      const token = cookieStoreMock.set.mock.calls[0][1] as string;
      const { payload } = await jwtVerify(token, new TextEncoder().encode(AUTH_SECRET));
      expect(payload.email).toBe("alice@example.com");
    });

    it("définit maxAge à 86400 (24h)", async () => {
      await createPortalSession("tenant-1", "alice@example.com");
      const options = cookieStoreMock.set.mock.calls[0][2];
      expect(options.maxAge).toBe(86400);
      expect(options.httpOnly).toBe(true);
    });
  });

  // ── getPortalSession ─────────────────────────────────────────────────────
  describe("getPortalSession", () => {
    it("retourne null si aucun cookie portal-token", async () => {
      cookieStoreMock.get.mockReturnValue(undefined);
      const session = await getPortalSession();
      expect(session).toBeNull();
    });

    it("retourne la session si le token est valide", async () => {
      const token = await makeToken({ tenantId: "tenant-42", email: "bob@example.com" });
      cookieStoreMock.get.mockReturnValue({ value: token });
      const session = await getPortalSession();
      expect(session).toEqual({ tenantId: "tenant-42", email: "bob@example.com" });
    });

    it("retourne null si le token a un issuer incorrect", async () => {
      const token = await new SignJWT({ tenantId: "t1", email: "x@x.com" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("NOT_PORTAL")
        .setExpirationTime("24h")
        .sign(new TextEncoder().encode(AUTH_SECRET));
      cookieStoreMock.get.mockReturnValue({ value: token });
      const session = await getPortalSession();
      expect(session).toBeNull();
    });

    it("retourne null si le token est signé avec un mauvais secret", async () => {
      const token = await makeToken({ tenantId: "t1", email: "x@x.com" }, "wrong-secret-xxxxxxxxxxxxxxxxxx");
      cookieStoreMock.get.mockReturnValue({ value: token });
      const session = await getPortalSession();
      expect(session).toBeNull();
    });

    it("retourne null si tenantId manque dans le payload", async () => {
      const token = await makeToken({ email: "x@x.com" });
      cookieStoreMock.get.mockReturnValue({ value: token });
      const session = await getPortalSession();
      expect(session).toBeNull();
    });

    it("retourne null si email manque dans le payload", async () => {
      const token = await makeToken({ tenantId: "t1" });
      cookieStoreMock.get.mockReturnValue({ value: token });
      const session = await getPortalSession();
      expect(session).toBeNull();
    });

    it("retourne null si le token est malformé", async () => {
      cookieStoreMock.get.mockReturnValue({ value: "not.a.jwt" });
      const session = await getPortalSession();
      expect(session).toBeNull();
    });
  });

  // ── requirePortalAuth ────────────────────────────────────────────────────
  describe("requirePortalAuth", () => {
    it("retourne la session si valide", async () => {
      const token = await makeToken({ tenantId: "tenant-99", email: "test@test.com" });
      cookieStoreMock.get.mockReturnValue({ value: token });
      const session = await requirePortalAuth();
      expect(session.tenantId).toBe("tenant-99");
    });

    it("lève une erreur si aucune session valide", async () => {
      cookieStoreMock.get.mockReturnValue(undefined);
      await expect(requirePortalAuth()).rejects.toThrow("Accès portail non autorisé");
    });
  });

  // ── clearPortalSession ───────────────────────────────────────────────────
  describe("clearPortalSession", () => {
    it("appelle cookieStore.delete avec portal-token", async () => {
      await clearPortalSession();
      expect(cookieStoreMock.delete).toHaveBeenCalledWith("portal-token");
    });
  });
});
