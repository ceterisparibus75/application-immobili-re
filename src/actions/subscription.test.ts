import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import {
  getSubscription,
  createCheckout,
  openBillingPortal,
  cancelCurrentSubscription,
  forceSyncSubscription,
  syncAllAdminSubscriptions,
} from "@/actions/subscription"
import { UserRole } from "@/generated/prisma/client"
import { prismaMock } from "@/test/mocks/prisma"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }) } },
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/test" }) } },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({ status: "active", items: { data: [{ price: { id: "price_starter_m" } }] }, customer: "cus_test", cancel_at: null, trial_end: null }),
      update: vi.fn().mockResolvedValue({}),
    },
  })),
  createCheckoutSession: vi.fn().mockResolvedValue("https://checkout.stripe.com/test"),
  createCustomerPortalSession: vi.fn().mockResolvedValue("https://billing.stripe.com/portal"),
  PLANS: {
    STARTER: { name: "Starter", maxLots: 20, maxSocieties: 1, maxUsers: 2, features: ["Gestion de patrimoine"] },
    PRO: { name: "Pro", maxLots: 50, maxSocieties: 3, maxUsers: 5, features: ["Tout Starter +"] },
    ENTERPRISE: { name: "Enterprise", maxLots: Infinity, maxSocieties: Infinity, maxUsers: Infinity, features: ["Tout Pro +"] },
  },
  PRICE_IDS: { STARTER: { monthly: "price_starter_m", yearly: "price_starter_y" }, PRO: { monthly: "price_pro_m", yearly: "price_pro_y" }, ENTERPRISE: { monthly: "", yearly: "" } },
  planIdFromPriceId: vi.fn((priceId: string) => {
    if (priceId.includes("starter")) return "STARTER"
    if (priceId.includes("pro")) return "PRO"
    return null
  }),
}))

const buildSubscription = (overrides = {}) => ({
  id: "sub-1",
  societyId: "society-1",
  planId: "STARTER",
  status: "ACTIVE",
  stripeCustomerId: "cus_test",
  stripeSubscriptionId: "sub_stripe_1",
  stripePriceId: "price_starter_m",
  trialEnd: null,
  currentPeriodEnd: new Date("2026-12-31"),
  cancelAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe("getSubscription", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getSubscription("society-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("retourne les données avec rôle LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    prismaMock.subscription.findUnique.mockResolvedValue(buildSubscription() as never)
    prismaMock.subscription.update.mockResolvedValue(buildSubscription() as never)
    const r = await getSubscription("society-1")
    expect(r.success).toBe(true)
    expect(r.data).toBeDefined()
    expect(r.data?.planId).toBe("STARTER")
    expect(r.data?.status).toBe("ACTIVE")
  })
})

describe("createCheckout", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await createCheckout("society-1", "STARTER" as never, "monthly")
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si rôle LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await createCheckout("society-1", "STARTER" as never, "monthly")
    expect(r.success).toBe(false)
  })

  it("erreur si prix non configuré (Enterprise)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.subscription.findUnique.mockResolvedValue(buildSubscription({ stripeCustomerId: null }) as never)
    const r = await createCheckout("society-1", "ENTERPRISE" as never, "monthly")
    expect(r.success).toBe(false)
    expect(r.error).toContain("configurée")
  })
})

describe("openBillingPortal", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await openBillingPortal("society-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si rôle GESTIONNAIRE (requiert ADMIN)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await openBillingPortal("society-1")
    expect(r.success).toBe(false)
  })

  it("erreur si pas d'abonnement Stripe", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.subscription.findUnique.mockResolvedValue(null as never)
    const r = await openBillingPortal("society-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("abonnement")
  })
})

describe("cancelCurrentSubscription", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await cancelCurrentSubscription("society-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si rôle COMPTABLE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await cancelCurrentSubscription("society-1")
    expect(r.success).toBe(false)
  })

  it("erreur si pas d'abonnement Stripe", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.subscription.findUnique.mockResolvedValue(null as never)
    const r = await cancelCurrentSubscription("society-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("abonnement")
  })

  it("erreur si pas de stripeSubscriptionId", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.subscription.findUnique.mockResolvedValue(buildSubscription({ stripeSubscriptionId: null }) as never)
    const r = await cancelCurrentSubscription("society-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("abonnement")
  })

  it("annule l'abonnement avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.subscription.findUnique.mockResolvedValue(buildSubscription() as never)
    const r = await cancelCurrentSubscription("society-1")
    expect(r.success).toBe(true)
  })
})

describe("openBillingPortal", () => {
  it("ouvre le portail de facturation avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.subscription.findUnique.mockResolvedValue(buildSubscription() as never)
    const r = await openBillingPortal("society-1")
    expect(r.success).toBe(true)
    expect(r.data?.url).toContain("billing.stripe.com")
  })
})

describe("forceSyncSubscription", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await forceSyncSubscription("society-1")
    expect(r.success).toBe(false)
  })

  it("erreur si aucun abonnement", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.subscription.findUnique.mockResolvedValue(null as never)
    const r = await forceSyncSubscription("society-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("Aucun abonnement")
  })

  it("erreur si pas de stripeSubscriptionId", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.subscription.findUnique.mockResolvedValue(buildSubscription({ stripeSubscriptionId: null }) as never)
    const r = await forceSyncSubscription("society-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("Stripe")
  })

  it("synchronise l'abonnement Stripe avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.subscription.findUnique.mockResolvedValue(buildSubscription() as never)
    prismaMock.subscription.update.mockResolvedValue(buildSubscription() as never)
    const r = await forceSyncSubscription("society-1")
    expect(r.success).toBe(true)
    expect(r.data?.status).toBe("ACTIVE")
    expect(r.data?.planId).toBe("STARTER")
  })
})

describe("syncAllAdminSubscriptions", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await syncAllAdminSubscriptions()
    expect(r.success).toBe(false)
  })

  it("retourne 0 si aucune société admin", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.userSociety.findMany.mockResolvedValue([] as never)
    const r = await syncAllAdminSubscriptions()
    expect(r.success).toBe(true)
    expect(r.data?.synced).toBe(0)
  })

  it("synchronise les abonnements Stripe des sociétés admin", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.userSociety.findMany.mockResolvedValue([{ societyId: "society-1" }] as never)
    prismaMock.subscription.findMany.mockResolvedValue([buildSubscription()] as never)
    prismaMock.subscription.findUnique.mockResolvedValue(buildSubscription() as never)
    prismaMock.subscription.update.mockResolvedValue(buildSubscription() as never)
    const r = await syncAllAdminSubscriptions()
    expect(r.success).toBe(true)
    expect(r.data?.synced).toBe(1)
  })
})
