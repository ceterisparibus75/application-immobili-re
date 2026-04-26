import { describe, it, expect, vi } from "vitest";

vi.mock("stripe", () => ({
  default: class {
    constructor() {}
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_fake",
    STRIPE_PRICE_STARTER_MONTHLY: "price_starter_monthly",
    STRIPE_PRICE_STARTER_YEARLY: "price_starter_yearly",
    STRIPE_PRICE_PRO_MONTHLY: "price_pro_monthly",
    STRIPE_PRICE_PRO_YEARLY: "price_pro_yearly",
    STRIPE_PRICE_ENTERPRISE_MONTHLY: "price_enterprise_monthly",
    STRIPE_PRICE_ENTERPRISE_YEARLY: "price_enterprise_yearly",
  },
}));

import { PLANS, getPlanLimits, planIdFromPriceId } from "./stripe";

describe("PLANS", () => {
  it("STARTER a 20 lots max et 1 société", () => {
    expect(PLANS.STARTER.maxLots).toBe(20);
    expect(PLANS.STARTER.maxSocieties).toBe(1);
    expect(PLANS.STARTER.maxUsers).toBe(2);
  });

  it("PRO a 50 lots max et 3 sociétés", () => {
    expect(PLANS.PRO.maxLots).toBe(50);
    expect(PLANS.PRO.maxSocieties).toBe(3);
    expect(PLANS.PRO.maxUsers).toBe(5);
  });

  it("ENTERPRISE est illimité (-1)", () => {
    expect(PLANS.ENTERPRISE.maxLots).toBe(-1);
    expect(PLANS.ENTERPRISE.maxSocieties).toBe(-1);
    expect(PLANS.ENTERPRISE.maxUsers).toBe(-1);
  });
});

describe("getPlanLimits", () => {
  it("retourne les limites du plan STARTER", () => {
    const limits = getPlanLimits("STARTER");
    expect(limits).toEqual(PLANS.STARTER);
  });

  it("retourne les limites du plan PRO", () => {
    const limits = getPlanLimits("PRO");
    expect(limits.maxLots).toBe(50);
  });

  it("retourne les limites du plan ENTERPRISE", () => {
    const limits = getPlanLimits("ENTERPRISE");
    expect(limits.maxLots).toBe(-1);
  });
});

describe("planIdFromPriceId", () => {
  it("retourne STARTER pour le price ID mensuel (B8 arm0, B9 arm0)", () => {
    expect(planIdFromPriceId("price_starter_monthly")).toBe("STARTER");
  });

  it("retourne PRO pour le price ID annuel", () => {
    expect(planIdFromPriceId("price_pro_yearly")).toBe("PRO");
  });

  it("retourne ENTERPRISE pour le price ID mensuel", () => {
    expect(planIdFromPriceId("price_enterprise_monthly")).toBe("ENTERPRISE");
  });

  it("retourne null si aucun plan ne correspond (B8 arm1 — if jamais vrai)", () => {
    expect(planIdFromPriceId("price_inconnu")).toBeNull();
  });
});
