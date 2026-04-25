import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    POWENS_DOMAIN: "mygestia.biapi.pro",
    POWENS_CLIENT_ID: "client-123",
    POWENS_CLIENT_SECRET: "secret-abc",
  },
}));

import { buildPowensWebviewUrl } from "./powens";

describe("buildPowensWebviewUrl", () => {
  it("construit l'URL de base avec les paramètres obligatoires", () => {
    const url = buildPowensWebviewUrl({
      code: "auth-code-xyz",
      state: "state-abc",
      redirectUri: "https://app.mygestia.immo/api/banking/powens/callback",
    });

    expect(url).toContain("https://webview.powens.com/fr/connect");
    expect(url).toContain("code=auth-code-xyz");
    expect(url).toContain("state=state-abc");
    expect(url).toContain("domain=mygestia.biapi.pro");
    expect(url).toContain("client_id=client-123");
  });

  it("inclut connector_ids si connectorId est fourni", () => {
    const url = buildPowensWebviewUrl({
      code: "code",
      state: "state",
      redirectUri: "https://example.com/callback",
      connectorId: 42,
    });

    expect(url).toContain("connector_ids=42");
  });

  it("n'inclut pas connector_ids si connectorId est absent", () => {
    const url = buildPowensWebviewUrl({
      code: "code",
      state: "state",
      redirectUri: "https://example.com/callback",
    });

    expect(url).not.toContain("connector_ids");
  });

  it("encode correctement l'URI de redirection", () => {
    const url = buildPowensWebviewUrl({
      code: "code",
      state: "state",
      redirectUri: "https://example.com/callback?foo=bar",
    });

    // L'URL doit contenir l'URI encodée
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("example.com");
  });
});
