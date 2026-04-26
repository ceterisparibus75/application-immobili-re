import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockLimit = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  getApiRatelimit: vi.fn(() => ({ limit: mockLimit })),
}));

import { enforceWebhookRateLimit } from "./webhook-rate-limit";

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("https://example.com/api/webhooks/test", { headers });
}

describe("enforceWebhookRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne null si la requête n'est pas rate-limitée", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    const req = makeRequest();
    const result = await enforceWebhookRateLimit(req, "stripe");
    expect(result).toBeNull();
  });

  it("retourne une réponse 429 si la requête est rate-limitée", async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 5_000 });
    const req = makeRequest();
    const result = await enforceWebhookRateLimit(req, "stripe");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("inclut l'en-tête Retry-After dans la réponse 429", async () => {
    const reset = Date.now() + 8_000;
    mockLimit.mockResolvedValue({ success: false, reset });
    const req = makeRequest();
    const result = await enforceWebhookRateLimit(req, "stripe");
    const retryAfter = parseInt(result!.headers.get("Retry-After") ?? "0", 10);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("extrait l'IP depuis x-forwarded-for", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    await enforceWebhookRateLimit(req, "gocardless");
    expect(mockLimit).toHaveBeenCalledWith("webhook:gocardless:1.2.3.4");
  });

  it("extrait l'IP depuis x-real-ip si x-forwarded-for est absent", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    const req = makeRequest({ "x-real-ip": "9.8.7.6" });
    await enforceWebhookRateLimit(req, "docusign");
    expect(mockLimit).toHaveBeenCalledWith("webhook:docusign:9.8.7.6");
  });

  it("utilise 127.0.0.1 si aucun header IP n'est présent", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    const req = makeRequest();
    await enforceWebhookRateLimit(req, "resend");
    expect(mockLimit).toHaveBeenCalledWith("webhook:resend:127.0.0.1");
  });

  it("inclut le nom du provider dans la clé de rate limiting", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 10_000 });
    await enforceWebhookRateLimit(makeRequest(), "stripe");
    await enforceWebhookRateLimit(makeRequest(), "gocardless");
    expect(mockLimit.mock.calls[0][0]).toContain("stripe");
    expect(mockLimit.mock.calls[1][0]).toContain("gocardless");
  });
});
