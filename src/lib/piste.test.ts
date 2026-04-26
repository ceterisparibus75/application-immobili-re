import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockEnv = vi.hoisted(() => ({
  PISTE_CLIENT_ID: "",
  PISTE_CLIENT_SECRET: "",
  PISTE_ENV: "sandbox" as const,
  CHORUS_PRO_ENV: "sandbox" as const,
  CHORUS_PRO_TECH_ACCOUNT: "",
  CHORUS_PRO_TECH_PASSWORD: "",
  CHORUS_PRO_TECH_USER_ID: 0,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

import { isPisteConfigured, invalidatePisteToken, getPisteToken } from "./piste";

describe("isPisteConfigured", () => {
  it("retourne false si les variables PISTE ne sont pas définies", () => {
    mockEnv.PISTE_CLIENT_ID = "";
    mockEnv.PISTE_CLIENT_SECRET = "";
    expect(isPisteConfigured()).toBe(false);
  });

  it("retourne true si les deux variables PISTE sont définies", () => {
    mockEnv.PISTE_CLIENT_ID = "my-client-id";
    mockEnv.PISTE_CLIENT_SECRET = "my-client-secret";
    expect(isPisteConfigured()).toBe(true);
  });

  it("retourne false si seulement PISTE_CLIENT_ID est défini", () => {
    mockEnv.PISTE_CLIENT_ID = "my-client-id";
    mockEnv.PISTE_CLIENT_SECRET = "";
    expect(isPisteConfigured()).toBe(false);
  });
});

describe("invalidatePisteToken", () => {
  it("s'exécute sans erreur (side effect interne)", () => {
    expect(() => invalidatePisteToken()).not.toThrow();
  });
});

describe("getPisteToken — branches (B0-B5)", () => {
  beforeEach(() => {
    invalidatePisteToken(); // reset cache entre tests
    vi.restoreAllMocks();
  });
  afterEach(() => {
    invalidatePisteToken();
  });

  it("lève une erreur si PISTE_CLIENT_ID manque (B2 arm0, B3 arm0)", async () => {
    mockEnv.PISTE_CLIENT_ID = "";
    mockEnv.PISTE_CLIENT_SECRET = "secret";
    await expect(getPisteToken()).rejects.toThrow("PISTE_CLIENT_ID");
  });

  it("lève une erreur si PISTE_CLIENT_ID présent mais PISTE_CLIENT_SECRET manque (B3 arm1)", async () => {
    mockEnv.PISTE_CLIENT_ID = "id";
    mockEnv.PISTE_CLIENT_SECRET = "";
    await expect(getPisteToken()).rejects.toThrow("PISTE_CLIENT_ID");
  });

  it("retourne le token si le fetch réussit (B2 arm1, B5 arm1) + utilise PISTE_ENV (B4 arm0)", async () => {
    mockEnv.PISTE_CLIENT_ID = "my-id";
    mockEnv.PISTE_CLIENT_SECRET = "my-secret";
    mockEnv.PISTE_ENV = "sandbox";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "tok_abc", expires_in: 3600 }),
    });
    const token = await getPisteToken();
    expect(token).toBe("tok_abc");
  });

  it("utilise 'sandbox' si PISTE_ENV absent (B4 arm1)", async () => {
    mockEnv.PISTE_CLIENT_ID = "my-id";
    mockEnv.PISTE_CLIENT_SECRET = "my-secret";
    (mockEnv as Record<string, unknown>).PISTE_ENV = undefined;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "tok_def", expires_in: 3600 }),
    });
    const token = await getPisteToken();
    expect(token).toBe("tok_def");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("sandbox");
  });

  it("lève une erreur si le fetch échoue (B5 arm0)", async () => {
    mockEnv.PISTE_CLIENT_ID = "my-id";
    mockEnv.PISTE_CLIENT_SECRET = "my-secret";
    mockEnv.PISTE_ENV = "sandbox";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, text: () => Promise.resolve("Unauthorized"),
    });
    await expect(getPisteToken()).rejects.toThrow("Échec obtention token PISTE");
  });

  it("retourne le token du cache si valide (B0/B1 arm0)", async () => {
    mockEnv.PISTE_CLIENT_ID = "my-id";
    mockEnv.PISTE_CLIENT_SECRET = "my-secret";
    mockEnv.PISTE_ENV = "sandbox";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "tok_cached", expires_in: 3600 }),
    });
    // Premier appel : fetch + mise en cache
    await getPisteToken();
    // Second appel : cache valide → pas de fetch supplémentaire
    const token2 = await getPisteToken();
    expect(token2).toBe("tok_cached");
    expect(global.fetch).toHaveBeenCalledTimes(1); // fetch appelé une seule fois
  });
});
