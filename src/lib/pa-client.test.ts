import { beforeEach, describe, it, expect, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  PA_API_BASE_URL: "" as string | undefined,
  PA_API_KEY: "" as string | undefined,
  PA_AUTH_CLIENT_ID: "" as string | undefined,
  PA_AUTH_CLIENT_SECRET: "" as string | undefined,
  PA_OAUTH_AUTHORIZE_URL: "" as string | undefined,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

import { isEInvoicingConfigured } from "./pa-client";

describe("isEInvoicingConfigured", () => {
  beforeEach(() => {
    mockEnv.PA_API_BASE_URL = "";
    mockEnv.PA_API_KEY = "";
    mockEnv.PA_AUTH_CLIENT_ID = "";
    mockEnv.PA_AUTH_CLIENT_SECRET = "";
    mockEnv.PA_OAUTH_AUTHORIZE_URL = "";
  });

  it("retourne false si PA_API_BASE_URL est absente", () => {
    mockEnv.PA_API_BASE_URL = "";
    mockEnv.PA_API_KEY = "some-key";
    expect(isEInvoicingConfigured()).toBe(false);
  });

  it("retourne false si PA_API_BASE_URL est présente mais aucun mécanisme d'auth", () => {
    mockEnv.PA_API_BASE_URL = "https://api.pa.example.com";
    expect(isEInvoicingConfigured()).toBe(false);
  });

  it("retourne true si PA_API_KEY est défini", () => {
    mockEnv.PA_API_BASE_URL = "https://api.pa.example.com";
    mockEnv.PA_API_KEY = "my-api-key";
    expect(isEInvoicingConfigured()).toBe(true);
  });

  it("retourne true si PA_AUTH_CLIENT_ID et PA_AUTH_CLIENT_SECRET sont définis", () => {
    mockEnv.PA_API_BASE_URL = "https://api.pa.example.com";
    mockEnv.PA_AUTH_CLIENT_ID = "client-id";
    mockEnv.PA_AUTH_CLIENT_SECRET = "client-secret";
    expect(isEInvoicingConfigured()).toBe(true);
  });

  it("retourne false si seulement PA_AUTH_CLIENT_ID est défini (sans SECRET)", () => {
    mockEnv.PA_API_BASE_URL = "https://api.pa.example.com";
    mockEnv.PA_AUTH_CLIENT_ID = "client-id";
    mockEnv.PA_AUTH_CLIENT_SECRET = "";
    expect(isEInvoicingConfigured()).toBe(false);
  });

  it("retourne true si PA_OAUTH_AUTHORIZE_URL est défini", () => {
    mockEnv.PA_API_BASE_URL = "https://api.pa.example.com";
    mockEnv.PA_OAUTH_AUTHORIZE_URL = "https://auth.pa.example.com/authorize";
    expect(isEInvoicingConfigured()).toBe(true);
  });
});
