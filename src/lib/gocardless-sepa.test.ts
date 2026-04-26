import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    GOCARDLESS_SECRET_ID: "sandbox_id",
    GOCARDLESS_SECRET_KEY: "sandbox_key",
  },
}));

import { createHmac } from "crypto";
import { validateGocardlessWebhook, createCustomer, createMandate, getMandate } from "./gocardless-sepa";

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

const mockFetchOk = (json: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(json) });

describe("createCustomer — branches gcFetch (B1-B4)", () => {
  beforeEach(() => {
    process.env.GOCARDLESS_PAYMENTS_KEY = "test-key-sepa";
  });
  afterEach(() => {
    delete process.env.GOCARDLESS_PAYMENTS_KEY;
    vi.restoreAllMocks();
  });

  it("lève une erreur si GOCARDLESS_PAYMENTS_KEY absent (B1 arm0)", async () => {
    delete process.env.GOCARDLESS_PAYMENTS_KEY;
    await expect(
      createCustomer({ email: "a@b.com", givenName: "A", familyName: "B" })
    ).rejects.toThrow("GOCARDLESS_PAYMENTS_KEY");
  });

  it("crée un client avec body JSON (B2 arm0) et retourne les données", async () => {
    global.fetch = mockFetchOk({ customers: { id: "CU001", email: "a@b.com" } });
    const result = await createCustomer({
      email: "a@b.com", givenName: "A", familyName: "B", countryCode: "DE",
    });
    expect(result.id).toBe("CU001");
  });

  it("utilise 'FR' si countryCode absent (B4 arm1)", async () => {
    global.fetch = mockFetchOk({ customers: { id: "CU002", email: "a@b.com" } });
    await createCustomer({ email: "a@b.com", givenName: "A", familyName: "B" });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.customers.country_code).toBe("FR");
  });

  it("lève une erreur si la réponse n'est pas ok (B3 arm0)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 422, text: () => Promise.resolve("Unprocessable"),
    });
    await expect(
      createCustomer({ email: "a@b.com", givenName: "A", familyName: "B" })
    ).rejects.toThrow("GoCardless");
  });
});

describe("getMandate — body absent dans gcFetch (B2 arm1)", () => {
  beforeEach(() => {
    process.env.GOCARDLESS_PAYMENTS_KEY = "test-key-sepa";
  });
  afterEach(() => {
    delete process.env.GOCARDLESS_PAYMENTS_KEY;
    vi.restoreAllMocks();
  });

  it("passe undefined comme body pour un GET (B2 arm1)", async () => {
    global.fetch = mockFetchOk({ mandates: { id: "MD001", status: "active", scheme: "sepa_core", reference: "REF", created_at: "", links: {} } });
    const result = await getMandate("MD001");
    expect(result.id).toBe("MD001");
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].body).toBeUndefined(); // B2 arm1: no body
  });
});

describe("createMandate — branches creditorId/reference (B5-B7)", () => {
  beforeEach(() => {
    process.env.GOCARDLESS_PAYMENTS_KEY = "test-key-sepa";
    process.env.GOCARDLESS_PAYMENTS_CREDITOR_ID = "CR001";
  });
  afterEach(() => {
    delete process.env.GOCARDLESS_PAYMENTS_KEY;
    delete process.env.GOCARDLESS_PAYMENTS_CREDITOR_ID;
    vi.restoreAllMocks();
  });

  it("utilise creditorId de l'env si absent dans le paramètre (B5 arm1) et ajoute reference (B6/B7 arm0)", async () => {
    global.fetch = mockFetchOk({ mandates: { id: "MD002", status: "active", scheme: "sepa_core", reference: "R1", created_at: "", links: {} } });
    const result = await createMandate({
      customerBankAccountId: "BA001",
      reference: "REF-001", // B7 arm0
      // no creditorId → uses env (B5 arm1) + B6 arm0 (truthy)
    });
    expect(result.id).toBe("MD002");
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.mandates.links.creditor).toBe("CR001"); // from env
    expect(body.mandates.reference).toBe("REF-001");
  });

  it("ignore creditorId si null et reference si absent (B6/B7 arm1)", async () => {
    delete process.env.GOCARDLESS_PAYMENTS_CREDITOR_ID;
    global.fetch = mockFetchOk({ mandates: { id: "MD003", status: "active", scheme: "sepa_core", reference: "", created_at: "", links: {} } });
    await createMandate({ customerBankAccountId: "BA002" }); // no creditorId, no reference
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.mandates.links.creditor).toBeUndefined(); // B6 arm1
    expect(body.mandates.reference).toBeUndefined(); // B7 arm1
  });
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
