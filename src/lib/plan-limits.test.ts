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

// ── checkCoveredByOwnerSubscription (via checkSubscriptionActive) ─

describe("checkSubscriptionActive — couverture par abonnement admin croisé", () => {
  it("retourne active=true si l'admin a un plan PRO ACTIVE sur une autre société couvrant celle-ci", async () => {
    // La société cible a un abonnement CANCELED
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "CANCELED", stripeSubscriptionId: null })
    );

    // checkCoveredByOwnerSubscription: admins de la société
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ userId: USER_ID }] as never)  // admins
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }, { societyId: "soc-2" }] as never); // allMemberships

    // Abonnements ACTIVE sur les sociétés de l'admin
    prismaMock.subscription.findMany.mockResolvedValue([
      { societyId: "soc-2", planId: "PRO" },
    ] as never);

    // Sociétés triées par date de création (SOCIETY_ID + soc-2, toutes dans quota PRO=3)
    prismaMock.society.findMany.mockResolvedValue([
      { id: SOCIETY_ID, createdAt: new Date("2025-01-01") },
      { id: "soc-2", createdAt: new Date("2025-06-01") },
    ] as never);

    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(true);
    expect(result.status).toBe("ACTIVE");
  });

  it("retourne OVER_LIMIT si le quota du plan est dépassé", async () => {
    // La société cible a un abonnement CANCELED
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "CANCELED", stripeSubscriptionId: null })
    );

    // checkCoveredByOwnerSubscription: l'admin gère 2 sociétés, mais le plan STARTER n'en permet qu'1
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ userId: USER_ID }] as never)  // admins
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }, { societyId: "soc-paying" }] as never);

    prismaMock.subscription.findMany.mockResolvedValue([
      { societyId: "soc-paying", planId: "STARTER" },
    ] as never);

    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-paying", createdAt: new Date("2025-01-01") },  // prioritaire (payante)
      { id: SOCIETY_ID, createdAt: new Date("2025-06-01") },   // hors quota
    ] as never);

    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(false);
    expect(result.status).toBe("OVER_LIMIT");
    expect(result.message).toContain("Starter");
  });

  it("retourne active=true pour TRIALING sans trialEnd (daysLeft undefined)", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "TRIALING", trialEnd: null })
    );
    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(true);
    expect(result.status).toBe("TRIALING");
    expect(result.daysLeft).toBeUndefined();
  });
});

describe("checkSubscriptionActive — sync Stripe silencieuse (lignes 103-120)", () => {
  it("synchronise depuis Stripe si statut non-ACTIVE avec stripeSubscriptionId", async () => {
    const { getStripe } = await import("@/lib/stripe");
    vi.mocked(getStripe).mockReturnValueOnce({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "active",
          items: { data: [{ price: { id: null } }] },
          metadata: {},
          trial_end: null,
          cancel_at: null,
        }),
      },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "TRIALING", stripeSubscriptionId: "stripe-sub-1" })
    );
    prismaMock.subscription.update.mockResolvedValue(
      makeSubscription({ status: "ACTIVE" })
    );

    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(true);
    expect(result.status).toBe("ACTIVE");
    expect(prismaMock.subscription.update).toHaveBeenCalled();
  });
});

describe("checkCoveredByOwnerSubscription — branches manquantes", () => {
  it("retourne covered=false si admins trouvés mais aucun abonnement actif (ligne 241)", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "CANCELED", stripeSubscriptionId: null })
    );
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ societyId: "soc-other" }] as never);
    prismaMock.subscription.findMany.mockResolvedValue([] as never);

    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(false);
  });

  it("prend le meilleur abonnement quand plusieurs plans actifs (ligne 246)", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "CANCELED", stripeSubscriptionId: null })
    );
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }, { societyId: "soc-2" }, { societyId: "soc-3" }] as never);
    prismaMock.subscription.findMany.mockResolvedValue([
      { societyId: "soc-2", planId: "STARTER" },
      { societyId: "soc-3", planId: "PRO" },
    ] as never);
    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-3", createdAt: new Date("2025-01-01") },
      { id: SOCIETY_ID, createdAt: new Date("2025-02-01") },
      { id: "soc-2", createdAt: new Date("2025-03-01") },
    ] as never);

    const result = await checkSubscriptionActive(SOCIETY_ID);
    // PRO: maxSocieties=3, soc-3 (paying) + SOCIETY_ID + soc-2 → SOCIETY_ID est couvert
    expect(result.active).toBe(true);
  });

  it("retourne covered=true immédiatement pour plan ENTERPRISE illimité (ligne 254)", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "CANCELED", stripeSubscriptionId: null })
    );
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ societyId: "soc-enterprise" }] as never);
    prismaMock.subscription.findMany.mockResolvedValue([
      { societyId: "soc-enterprise", planId: "ENTERPRISE" },
    ] as never);

    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(true);
    expect(prismaMock.society.findMany).not.toHaveBeenCalled();
  });
});

describe("checkSignatureFeature — branches getSocietyPlan non couvertes", () => {
  it("retourne allowed=false si aucun abonnement (ligne 332)", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const result = await checkSignatureFeature(SOCIETY_ID);
    expect(result.allowed).toBe(false);
  });

  it("synchronise Stripe et autorise si plan ENTERPRISE après sync (lignes 336-348, 358)", async () => {
    const { getStripe } = await import("@/lib/stripe");
    vi.mocked(getStripe).mockReturnValueOnce({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "active",
          items: { data: [{ price: { id: null } }] },
          metadata: { planId: "ENTERPRISE" },
          trial_end: null,
          cancel_at: null,
        }),
      },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ planId: "ENTERPRISE", status: "TRIALING", stripeSubscriptionId: "stripe-sub-2" })
    );
    prismaMock.subscription.update.mockResolvedValue(
      makeSubscription({ planId: "ENTERPRISE", status: "ACTIVE" })
    );

    const result = await checkSignatureFeature(SOCIETY_ID);
    expect(result.allowed).toBe(true);
    expect(prismaMock.subscription.update).toHaveBeenCalled();
  });

  it("retourne STARTER si Stripe sync retourne CANCELED (ligne 357)", async () => {
    const { getStripe } = await import("@/lib/stripe");
    vi.mocked(getStripe).mockReturnValueOnce({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "canceled",
          items: { data: [] },
          metadata: {},
          trial_end: null,
          cancel_at: null,
        }),
      },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ planId: "ENTERPRISE", status: "PAST_DUE", stripeSubscriptionId: "stripe-sub-3" })
    );
    prismaMock.subscription.update.mockResolvedValue(
      makeSubscription({ planId: "ENTERPRISE", status: "CANCELED" })
    );

    const result = await checkSignatureFeature(SOCIETY_ID);
    expect(result.allowed).toBe(false);
  });

  it("retourne allowed=false pour abonnement CANCELED sans Stripe (ligne 364)", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ planId: "ENTERPRISE", status: "CANCELED", stripeSubscriptionId: null })
    );
    const result = await checkSignatureFeature(SOCIETY_ID);
    expect(result.allowed).toBe(false);
  });
});

// ── Branches Stripe non couvertes (checkSubscriptionActive) ────────

describe("checkSubscriptionActive — Stripe sync branches manquantes", () => {
  it("utilise 'INCOMPLETE' si statut Stripe inconnu → B11 arm1 L110 (?? 'INCOMPLETE')", async () => {
    const { getStripe } = await import("@/lib/stripe");
    vi.mocked(getStripe).mockReturnValueOnce({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "unknown_stripe_status",
          items: { data: [{ price: { id: null } }] },
          metadata: {},
          trial_end: null,
          cancel_at: null,
        }),
      },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "PAST_DUE", stripeSubscriptionId: "stripe-sub-x" })
    );
    prismaMock.subscription.update.mockResolvedValue(
      makeSubscription({ status: "INCOMPLETE" })
    );
    prismaMock.userSociety.findMany.mockResolvedValue([] as never);

    await checkSubscriptionActive(SOCIETY_ID);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "INCOMPLETE" }) })
    );
  });

  it("remplit trial_end, cancel_at et current_period_end depuis Stripe → B14 arm0, B15 arm0, B16 arm0, B17 arm0", async () => {
    const { getStripe } = await import("@/lib/stripe");
    vi.mocked(getStripe).mockReturnValueOnce({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "active",
          items: { data: [{ price: { id: null }, current_period_end: 1735689600 }] },
          metadata: {},
          trial_end: 1735689600,
          cancel_at: 1738368000,
        }),
      },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "TRIALING", stripeSubscriptionId: "stripe-sub-y" })
    );
    prismaMock.subscription.update.mockResolvedValue(makeSubscription({ status: "ACTIVE" }));

    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(true);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trialEnd: expect.any(Date),
          cancelAt: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
          trialUsed: true,
        }),
      })
    );
  });
});

// ── OVER_LIMIT pluriel et planId inconnu ──────────────────────────

describe("checkCoveredByOwnerSubscription — plural et planId inconnu", () => {
  it("OVER_LIMIT avec plan PRO (maxSocieties=3) → B27 arm0 L180 (pluriel 'sociétés')", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "CANCELED", stripeSubscriptionId: null })
    );
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ userId: USER_ID }] as never)
      .mockResolvedValueOnce([
        { societyId: "soc-paying" },
        { societyId: "soc-2" },
        { societyId: "soc-3" },
        { societyId: SOCIETY_ID },
      ] as never);
    prismaMock.subscription.findMany.mockResolvedValue([
      { societyId: "soc-paying", planId: "PRO" },
    ] as never);
    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-paying", createdAt: new Date("2025-01-01") },
      { id: "soc-2", createdAt: new Date("2025-02-01") },
      { id: "soc-3", createdAt: new Date("2025-03-01") },
      { id: SOCIETY_ID, createdAt: new Date("2025-04-01") },
    ] as never);

    const result = await checkSubscriptionActive(SOCIETY_ID);
    expect(result.active).toBe(false);
    expect(result.status).toBe("OVER_LIMIT");
    expect(result.message).toContain("3 sociétés");
  });

  it("planId inconnu dans le tri → B32 arm1 + B33 arm1 (planRank ?? 0) + B34 arm1 (limits ?? 1) + B26 arm1 (planName ?? '')", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: "CANCELED", stripeSubscriptionId: null })
    );
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ userId: USER_ID }] as never)
      .mockResolvedValueOnce([{ societyId: "soc-other" }, { societyId: SOCIETY_ID }] as never);
    // Two subscriptions with unknown planIds → sort comparator hits ?? 0 on both sides
    prismaMock.subscription.findMany.mockResolvedValue([
      { societyId: "soc-other", planId: "UNKNOWN_A" },
      { societyId: "soc-other2", planId: "UNKNOWN_B" },
    ] as never);
    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-other", createdAt: new Date("2025-01-01") },
      { id: SOCIETY_ID, createdAt: new Date("2025-06-01") },
    ] as never);

    const result = await checkSubscriptionActive(SOCIETY_ID);
    // UNKNOWN planId → limits undefined → maxSocieties = 1 → SOCIETY_ID not in slot 0 → OVER_LIMIT
    expect(result.active).toBe(false);
    expect(result.status).toBe("OVER_LIMIT");
  });
});

// ── requiresTwoFactor — statut null ──────────────────────────────

describe("requiresTwoFactor — statut null → B38 arm1 L305", () => {
  it("retourne false si subscription.status est null → B38 arm1 (?? '')", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      {
        userId: USER_ID,
        societyId: SOCIETY_ID,
        role: "ADMIN_SOCIETE",
        society: {
          subscription: { planId: "ENTERPRISE", status: null },
        },
      },
    ] as never);
    const result = await requiresTwoFactor(USER_ID);
    expect(result).toBe(false);
  });
});

// ── getSocietyPlan — Stripe sync branches manquantes ─────────────

describe("checkSignatureFeature — getSocietyPlan Stripe branches manquantes", () => {
  it("utilise 'INCOMPLETE' si statut Stripe inconnu + trial_end → B43 arm1 L343 + B46 arm0 L354", async () => {
    const { getStripe } = await import("@/lib/stripe");
    vi.mocked(getStripe).mockReturnValueOnce({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          status: "some_unknown_status",
          items: { data: [] },
          metadata: {},
          trial_end: 1735689600,
          cancel_at: null,
        }),
      },
    } as never);

    prismaMock.subscription.findUnique.mockResolvedValue(
      makeSubscription({ planId: "PRO", status: "PAST_DUE", stripeSubscriptionId: "stripe-sub-z" })
    );
    prismaMock.subscription.update.mockResolvedValue(
      makeSubscription({ planId: "PRO", status: "INCOMPLETE" })
    );

    const result = await checkSignatureFeature(SOCIETY_ID);
    // newStatus="INCOMPLETE" → not CANCELED/UNPAID → returns "PRO" → PRO ≠ ENTERPRISE → false
    expect(result.allowed).toBe(false);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ trialUsed: true }) })
    );
  });
});
