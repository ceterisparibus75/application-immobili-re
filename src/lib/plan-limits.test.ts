import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlanId, Subscription, SubscriptionStatus } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({ subscriptions: { retrieve: vi.fn() } })),
  PLANS: {
    STARTER: { name: "Starter", maxLots: 20, maxSocieties: 1, maxUsers: 2 },
    PRO: { name: "Pro", maxLots: 50, maxSocieties: 3, maxUsers: 5 },
    ENTERPRISE: { name: "Enterprise", maxLots: -1, maxSocieties: -1, maxUsers: -1 },
  },
  planIdFromPriceId: vi.fn(() => null),
}));
// Override le mock global du setup pour tester le vrai module
vi.mock("@/lib/plan-limits", async (importOriginal) => {
  return await importOriginal();
});

import { prismaMock } from "@/test/mocks/prisma";
import {
  checkLotLimit,
  checkUserLimit,
  checkSocietyLimit,
  checkSubscriptionActive,
  checkSignatureFeature,
  requiresTwoFactor,
} from "./plan-limits";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const USER_ID = "clh3x2z4k0001qh8g7z1y2v3u";

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    societyId: SOCIETY_ID,
    planId: "STARTER" as PlanId,
    status: "ACTIVE" as SubscriptionStatus,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    trialStart: null,
    trialEnd: null,
    trialUsed: false,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAt: null,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("checkLotLimit", () => {
  beforeEach(() => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription());
  });

  it("autorise si sous la limite (plan STARTER, 19 lots)", async () => {
    prismaMock.lot.count.mockResolvedValue(19);
    const result = await checkLotLimit(SOCIETY_ID);
    expect(result.allowed).toBe(true);
  });

  it("refuse si à la limite (plan STARTER, 20 lots)", async () => {
    prismaMock.lot.count.mockResolvedValue(20);
    const result = await checkLotLimit(SOCIETY_ID);
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/20 lots/);
    expect(result.message).toMatch(/Starter/);
  });

  it("autorise toujours si plan ENTERPRISE (illimité)", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription({ planId: "ENTERPRISE" }));
    prismaMock.lot.count.mockResolvedValue(9999);
    const result = await checkLotLimit(SOCIETY_ID);
    expect(result.allowed).toBe(true);
  });
});

describe("checkUserLimit", () => {
  beforeEach(() => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription());
  });

  it("autorise si sous la limite (plan STARTER, 1 utilisateur)", async () => {
    prismaMock.userSociety.count.mockResolvedValue(1);
    const result = await checkUserLimit(SOCIETY_ID);
    expect(result.allowed).toBe(true);
  });

  it("refuse si à la limite (plan STARTER, 2 utilisateurs)", async () => {
    prismaMock.userSociety.count.mockResolvedValue(2);
    const result = await checkUserLimit(SOCIETY_ID);
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/2 utilisateurs/);
  });

  it("autorise toujours si ENTERPRISE", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription({ planId: "ENTERPRISE" }));
    prismaMock.userSociety.count.mockResolvedValue(100);
    const result = await checkUserLimit(SOCIETY_ID);
    expect(result.allowed).toBe(true);
  });
});

describe("checkSubscriptionActive", () => {
  it("retourne active=false si aucun abonnement", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(false);
    expect(result.status).toBe("NONE");
  });

  it("retourne active=true si statut ACTIVE", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription({ status: "ACTIVE" }));
    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(true);
    expect(result.status).toBe("ACTIVE");
  });

  it("retourne active=true si TRIALING non expiré", async () => {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 jours
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "TRIALING", trialEnd })
    );
    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(true);
    expect(result.status).toBe("TRIALING");
    expect(result.daysLeft).toBeGreaterThan(0);
  });

  it("expire le trial si trialEnd dépassé", async () => {
    const trialEnd = new Date(Date.now() - 1000); // passé
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "TRIALING", trialEnd })
    );
    prismaMock.subscription.update.mockResolvedValue(makeSubscription({ status: "CANCELED", trialEnd }));
    // checkCoveredByOwnerSubscription → admins = []
    prismaMock.userSociety.findMany.mockResolvedValue([]);

    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(false);
    expect(result.status).toBe("TRIAL_EXPIRED");
  });

  it("retourne active=false et message PAST_DUE", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription({ status: "PAST_DUE" }));
    prismaMock.userSociety.findMany.mockResolvedValue([]);
    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(false);
    expect(result.message).toMatch(/paiement a échoué/);
  });

  it("retourne active=false et message générique pour CANCELED", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription({ status: "CANCELED" }));
    prismaMock.userSociety.findMany.mockResolvedValue([]);
    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(false);
    expect(result.message).toMatch(/n'est plus actif/);
  });
});

describe("checkSignatureFeature", () => {
  it("refuse si plan STARTER", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription({ planId: "STARTER" }));
    const result = await checkSignatureFeature(SOCIETY_ID);
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/Enterprise/);
  });

  it("autorise si plan ENTERPRISE", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(makeSubscription({ planId: "ENTERPRISE" }));
    const result = await checkSignatureFeature(SOCIETY_ID);
    expect(result.allowed).toBe(true);
  });
});

describe("requiresTwoFactor", () => {
  it("retourne false si aucun membership ENTERPRISE actif", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      {
        userId: USER_ID,
        societyId: SOCIETY_ID,
        role: "GESTIONNAIRE",
        society: {
          subscription: { planId: "STARTER", status: "ACTIVE" },
        },
      },
    ] as never);
    const result = await requiresTwoFactor(USER_ID);
    expect(result).toBe(false);
  });

  it("retourne true si un membership a plan ENTERPRISE ACTIVE", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      {
        userId: USER_ID,
        societyId: SOCIETY_ID,
        role: "ADMIN_SOCIETE",
        society: {
          subscription: { planId: "ENTERPRISE", status: "ACTIVE" },
        },
      },
    ] as never);
    const result = await requiresTwoFactor(USER_ID);
    expect(result).toBe(true);
  });

  it("retourne true si plan ENTERPRISE TRIALING", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      {
        userId: USER_ID,
        societyId: SOCIETY_ID,
        role: "ADMIN_SOCIETE",
        society: {
          subscription: { planId: "ENTERPRISE", status: "TRIALING" },
        },
      },
    ] as never);
    const result = await requiresTwoFactor(USER_ID);
    expect(result).toBe(true);
  });
});

// ── checkSocietyLimit ─────────────────────────────────────────────

describe("checkSocietyLimit", () => {
  it("autorise si l'utilisateur n'a aucune société", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([] as never);
    const result = await checkSocietyLimit(USER_ID);
    expect(result.allowed).toBe(true);
  });

  it("bloque si la limite STARTER (1 société) est atteinte", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      { societyId: SOCIETY_ID },
    ] as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ planId: "STARTER" as PlanId, status: "ACTIVE" as SubscriptionStatus })
    );
    const result = await checkSocietyLimit(USER_ID);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("1 sociét");
  });

  it("autorise si la limite PRO (3 sociétés) n'est pas atteinte", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      { societyId: "soc-1" },
      { societyId: "soc-2" },
    ] as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ planId: "PRO" as PlanId, status: "ACTIVE" as SubscriptionStatus })
    );
    const result = await checkSocietyLimit(USER_ID);
    expect(result.allowed).toBe(true);
  });

  it("autorise toujours avec le plan ENTERPRISE (illimité)", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      { societyId: "soc-1" },
      { societyId: "soc-2" },
      { societyId: "soc-3" },
      { societyId: "soc-4" },
    ] as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ planId: "ENTERPRISE" as PlanId, status: "ACTIVE" as SubscriptionStatus })
    );
    const result = await checkSocietyLimit(USER_ID);
    expect(result.allowed).toBe(true);
  });
});
