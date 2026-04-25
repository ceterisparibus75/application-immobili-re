import { describe, it, expect, vi } from "vitest";

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

import { isPisteConfigured, invalidatePisteToken } from "./piste";

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
