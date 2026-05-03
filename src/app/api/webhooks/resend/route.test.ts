import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "@/test/mocks/prisma";

const { verify, enforceWebhookRateLimit, applyResendDeliveryEvent } = vi.hoisted(() => ({
  verify: vi.fn(),
  enforceWebhookRateLimit: vi.fn().mockResolvedValue(null),
  applyResendDeliveryEvent: vi.fn().mockResolvedValue({ matched: 1 }),
}));

vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@/lib/webhook-rate-limit", () => ({ enforceWebhookRateLimit }));
vi.mock("@/lib/email-delivery-proof", () => ({ applyResendDeliveryEvent }));
vi.mock("svix", () => ({
  Webhook: vi.fn().mockImplementation(function Webhook() {
    return { verify };
  }),
}));

import { POST } from "./route";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/resend", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "svix-id": "evt_123",
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": "v1,signature",
    },
  });
}

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    prismaMock.chargeStatementDelivery.findMany.mockResolvedValue([
      { id: "delivery-1" },
    ] as never);
  });

  it("marque une preuve de décompte comme livrée et historise l'événement", async () => {
    verify.mockReturnValue({
      type: "email.delivered",
      created_at: "2026-05-03T10:00:00.000Z",
      data: { email_id: "email-123", to: ["tenant@example.test"] },
    });

    const response = await POST(request({}));

    expect(response.status).toBe(200);
    expect(applyResendDeliveryEvent).toHaveBeenCalledWith({
      providerEventId: "evt_123",
      event: {
        type: "email.delivered",
        created_at: "2026-05-03T10:00:00.000Z",
        data: { email_id: "email-123", to: ["tenant@example.test"] },
      },
    });
    expect(prismaMock.chargeStatementDelivery.findMany).toHaveBeenCalledWith({
      where: { provider: "resend", providerMessageId: "email-123" },
      select: { id: true },
    });
    expect(prismaMock.chargeStatementDelivery.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["delivery-1"] } },
      data: expect.objectContaining({
        status: "DELIVERED",
        deliveredAt: new Date("2026-05-03T10:00:00.000Z"),
        lastEventAt: new Date("2026-05-03T10:00:00.000Z"),
        lastEventType: "email.delivered",
      }),
    });
    expect(prismaMock.chargeStatementDeliveryEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          deliveryId: "delivery-1",
          provider: "resend",
          providerEventId: "evt_123",
          eventType: "email.delivered",
          occurredAt: new Date("2026-05-03T10:00:00.000Z"),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("rejette une signature invalide", async () => {
    verify.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(request({}));

    expect(response.status).toBe(401);
  });
});
