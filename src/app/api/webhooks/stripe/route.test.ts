import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/env", () => ({ env: process.env }));

const stripeMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSubscription: vi.fn(),
  planIdFromPriceId: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: stripeMocks.constructEvent },
    subscriptions: { retrieve: stripeMocks.retrieveSubscription },
  })),
  planIdFromPriceId: stripeMocks.planIdFromPriceId,
}));

import { POST } from "./route";

function webhookRequest(payload: unknown, signature = "sig_test") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "stripe-signature": signature },
  }) as never;
}

function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    metadata: {},
    trial_start: null,
    trial_end: null,
    cancel_at: null,
    canceled_at: null,
    items: {
      data: [
        {
          price: { id: "price_pro" },
          current_period_start: 1775001600,
          current_period_end: 1777593600,
        },
      ],
    },
    ...overrides,
  };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    stripeMocks.planIdFromPriceId.mockReturnValue("PRO");
    stripeMocks.retrieveSubscription.mockResolvedValue(stripeSubscription());
    prismaMock.subscription.upsert.mockResolvedValue({} as never);
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.subscription.update.mockResolvedValue({} as never);
  });

  it("retourne 400 si la signature ou le secret webhook manque", async () => {
    const withoutSignature = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      }) as never
    );
    expect(withoutSignature.status).toBe(400);

    delete process.env.STRIPE_WEBHOOK_SECRET;
    const withoutSecret = await POST(webhookRequest({}));
    expect(withoutSecret.status).toBe(400);
  });

  it("retourne 400 si Stripe rejette la signature", async () => {
    stripeMocks.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(webhookRequest({ id: "evt_1" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid signature" });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it("cree ou met a jour l'abonnement apres un checkout termine", async () => {
    stripeMocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { societyId: "soc-1" },
          customer: "cus_1",
          subscription: "sub_1",
        },
      },
    });

    const response = await POST(webhookRequest({ id: "evt_1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(stripeMocks.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith({
      where: { societyId: "soc-1" },
      create: expect.objectContaining({
        societyId: "soc-1",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        stripePriceId: "price_pro",
        planId: "PRO",
        status: "ACTIVE",
        currentPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      }),
      update: expect.objectContaining({
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        stripePriceId: "price_pro",
        planId: "PRO",
        status: "ACTIVE",
      }),
    });
  });

  it("marque l'abonnement en retard apres un echec de paiement", async () => {
    stripeMocks.constructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: { subscription: "sub_1" } },
    });
    prismaMock.subscription.findFirst.mockResolvedValue({
      id: "local-sub-1",
      societyId: "soc-1",
      stripeSubscriptionId: "sub_1",
    } as never);

    const response = await POST(webhookRequest({ id: "evt_2" }));

    expect(response.status).toBe(200);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: "local-sub-1" },
      data: { status: "PAST_DUE" },
    });
  });
});
