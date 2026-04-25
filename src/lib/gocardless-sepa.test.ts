import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    GOCARDLESS_SECRET_ID: "sandbox_id",
    GOCARDLESS_SECRET_KEY: "sandbox_key",
  },
}));

import { createHmac } from "crypto";
import { validateGocardlessWebhook } from "./gocardless-sepa";

const WEBHOOK_SECRET = "test-webhook-secret-abc123";

function makeSignature(body: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

beforeEach(() => {
  process.env.GOCARDLESS_PAYMENTS_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterEach(() => {
  delete process.env.GOCARDLESS_PAYMENTS_WEBHOOK_SECRET;
});

describe("validateGocardlessWebhook", () => {
  it("retourne true si la signature correspond au corps", () => {
    const body = Buffer.from('{"events":[]}');
    const signature = makeSignature(body, WEBHOOK_SECRET);

    expect(validateGocardlessWebhook(body, signature)).toBe(true);
  });

  it("retourne false si la signature ne correspond pas", () => {
    const body = Buffer.from('{"events":[]}');
    const wrongSignature = makeSignature(body, "wrong-secret");

    expect(validateGocardlessWebhook(body, wrongSignature)).toBe(false);
  });

  it("retourne false si la signature est vide", () => {
    const body = Buffer.from('{"events":[]}');
    expect(validateGocardlessWebhook(body, "")).toBe(false);
  });

  it("lève une erreur si la variable d'env n'est pas définie", () => {
    delete process.env.GOCARDLESS_PAYMENTS_WEBHOOK_SECRET;
    const body = Buffer.from("{}");

    expect(() => validateGocardlessWebhook(body, "any-sig")).toThrow(
      "GOCARDLESS_PAYMENTS_WEBHOOK_SECRET non définie"
    );
  });
});
