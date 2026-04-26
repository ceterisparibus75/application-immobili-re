import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { getStripe } = vi.hoisted(() => ({
  getStripe: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({ getStripe }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-26T06:30:00.000Z"));
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.STRIPE_SECRET_KEY;
  prismaMock.subscription.updateMany.mockResolvedValue({ count: 0 } as never);
  prismaMock.subscription.findMany.mockResolvedValue([]);
});

describe("GET /api/cron/sync-subscriptions", () => {
  it("retourne 401 si CRON_SECRET non configuré ou header manquant", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/sync-subscriptions") as never);
    expect(response.status).toBe(401);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization incorrect", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/sync-subscriptions", {
        headers: { Authorization: "Bearer wrong" },
      }) as never
    );
    expect(response.status).toBe(401);
  });

  it("expire les essais gratuits dépassés et retourne le compte", async () => {
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 2 } as never);

    const response = await GET(
      new Request("http://localhost/api/cron/sync-subscriptions", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, expiredTrials: 2, stripeUpdated: 0 });
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "TRIALING", stripeCustomerId: null }),
        data: { status: "CANCELED" },
      })
    );
  });

  it("synchronise les abonnements Stripe si STRIPE_SECRET_KEY est configuré", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.subscription.findMany.mockResolvedValue([
      { id: "sub-1", societyId: "soc-1", stripeSubscriptionId: "sub_stripe_1" },
    ] as never);
    const mockStripe = {
      subscriptions: { retrieve: vi.fn().mockResolvedValue({ status: "active" }) },
    };
    getStripe.mockReturnValue(mockStripe);
    prismaMock.subscription.update.mockResolvedValue({} as never);

    const response = await GET(
      new Request("http://localhost/api/cron/sync-subscriptions", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.stripeUpdated).toBe(1);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("ne synchronise pas Stripe si STRIPE_SECRET_KEY absent", async () => {
    await GET(
      new Request("http://localhost/api/cron/sync-subscriptions", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("retourne 500 si la BDD échoue", async () => {
    prismaMock.subscription.updateMany.mockRejectedValue(new Error("DB error"));
    const response = await GET(
      new Request("http://localhost/api/cron/sync-subscriptions", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(response.status).toBe(500);
  });
});
