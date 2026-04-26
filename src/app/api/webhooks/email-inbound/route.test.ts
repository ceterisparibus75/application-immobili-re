import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("resend", () => ({
  Resend: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: process.env }));

import { POST } from "./route";

describe("POST /api/webhooks/email-inbound", () => {
  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it("échoue fermé si le secret webhook Resend est absent", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/email-inbound", {
        method: "POST",
        body: JSON.stringify({ type: "email.received", data: {} }),
      })
    );

    expect(res.status).toBe(500);
  });

  it("rejette un webhook signé de façon invalide", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test_secret";

    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/email-inbound", {
        method: "POST",
        body: JSON.stringify({ type: "email.received", data: {} }),
        headers: {
          "svix-id": "msg_test",
          "svix-timestamp": String(Math.floor(Date.now() / 1000)),
          "svix-signature": "v1,invalid",
        },
      })
    );

    expect(res.status).toBe(401);
  });
});
