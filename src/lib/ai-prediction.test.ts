import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  calculateRiskScore,
  predictWithAI,
  collectTenantPaymentData,
  type TenantPaymentProfile,
  type PredictionResult,
} from "@/lib/ai-prediction"
import { prismaMock } from "@/test/mocks/prisma"

/* ─── Mock Anthropic SDK ─────────────────────────────────────────── */

const mockCreate = vi.fn()
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

/* ─── Mock env ───────────────────────────────────────────────────── */

vi.mock("@/lib/env", () => ({
  env: { ANTHROPIC_API_KEY: "test-api-key" },
}))

/* ─── Helpers ────────────────────────────────────────────────────── */

function buildProfile(overrides: Partial<TenantPaymentProfile> = {}): TenantPaymentProfile {
  return {
    tenantId: "tenant-1",
    tenantName: "Jean Locataire",
    leaseId: "lease-1",
    lotLabel: "Apt 1",
    monthlyRent: 800,
    paymentHistory: [],
    currentDebt: 0,
    leaseStartDate: "2023-01-01",
    latePaymentCount: 0,
    avgDaysLate: 0,
    ...overrides,
  }
}

function makePayment(
  status: "on_time" | "late" | "unpaid",
  daysLate = 0,
) {
  return {
    month: "janvier 2024",
    dueDate: "2024-01-05",
    paidDate: status === "unpaid" ? null : "2024-01-05",
    amount: 800,
    daysLate,
    status,
  }
}

function makeAnthropicResponse(json: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(json) }],
  }
}

/* ─── calculateRiskScore ─────────────────────────────────────────── */

describe("calculateRiskScore", () => {
  it("returns low risk for a perfect payment profile", () => {
    const profile = buildProfile({
      paymentHistory: Array.from({ length: 12 }, () => makePayment("on_time")),
    })

    const result = calculateRiskScore(profile)

    expect(result.riskLevel).toBe("low")
    expect(result.riskScore).toBe(0)
    expect(result.defaultProbability).toBe(0)
    expect(result.tenantId).toBe("tenant-1")
    expect(result.tenantName).toBe("Jean Locataire")
    expect(result.lotLabel).toBe("Apt 1")
    expect(result.recommendations).toContain("Aucune action nécessaire — locataire en règle")
  })

  it("returns medium risk for moderate late payments with some debt", () => {
    // currentDebt = 500, ratio = 500/800 = 0.625 -> 10 points (debt > 0, ratio < 1)
    // 4 late out of 12 = 0.33 -> 15 points (> 0.25)
    // avgDaysLate = 10 -> 5 points (> 5)
    // recent: last 3 are indices 9,10,11 — index 10 is late -> 0 points (recentLate < 2)
    // unpaid = 0 -> 0 points
    // Total = 30 -> medium (>= 20, < 45)
    const history = Array.from({ length: 12 }, (_, i) => {
      if (i === 2 || i === 5 || i === 8 || i === 10) return makePayment("late", 10)
      return makePayment("on_time")
    })

    const profile = buildProfile({
      paymentHistory: history,
      currentDebt: 500,
      latePaymentCount: 4,
      avgDaysLate: 10,
    })

    const result = calculateRiskScore(profile)

    expect(result.riskLevel).toBe("medium")
    expect(result.riskScore).toBeGreaterThanOrEqual(20)
    expect(result.riskScore).toBeLessThan(45)
  })

  it("returns high risk for frequent late payments with current debt", () => {
    // Debt: 900 / 800 = 1.125 ratio -> 20 points (debtRatio >= 1)
    // 4 late out of 12 = 0.33 -> 15 points (> 0.25)
    // avgDaysLate = 16 -> 12 points (> 15)
    // recent: last 3 = indices 9,10,11 — none late -> 0 points
    // unpaid = 0 -> 0 points
    // Total = 47 -> high (>= 45, < 70)
    const history = Array.from({ length: 12 }, (_, i) => {
      if (i === 1 || i === 3 || i === 5 || i === 7) return makePayment("late", 16)
      return makePayment("on_time")
    })

    const profile = buildProfile({
      paymentHistory: history,
      currentDebt: 900,
      latePaymentCount: 4,
      avgDaysLate: 16,
    })

    const result = calculateRiskScore(profile)

    expect(result.riskLevel).toBe("high")
    expect(result.riskScore).toBeGreaterThanOrEqual(45)
    expect(result.riskScore).toBeLessThan(70)
    expect(result.riskFactors.length).toBeGreaterThan(0)
  })

  it("returns critical risk for severe delinquency", () => {
    // Debt: 2500 / 800 = 3.125 -> 30 points (>= 3)
    // 10 late out of 12 = 0.83 -> 25 points (> 0.5)
    // avgDaysLate = 40 -> 20 points (> 30)
    // 3 recent late -> 15 points
    // 3 unpaid -> 10 points (min(10, 3*5)=10)
    // Total = 100 -> critical
    const history = Array.from({ length: 12 }, (_, i) => {
      if (i >= 9) return makePayment("unpaid", 999)
      if (i >= 2) return makePayment("late", 40)
      return makePayment("on_time")
    })

    const profile = buildProfile({
      paymentHistory: history,
      currentDebt: 2500,
      latePaymentCount: 10,
      avgDaysLate: 40,
    })

    const result = calculateRiskScore(profile)

    expect(result.riskLevel).toBe("critical")
    expect(result.riskScore).toBeGreaterThanOrEqual(70)
    expect(result.riskScore).toBeLessThanOrEqual(100)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it("clamps score to maximum 100", () => {
    // Overloaded scenario: all factors maxed
    const history = Array.from({ length: 12 }, () => makePayment("unpaid", 999))

    const profile = buildProfile({
      paymentHistory: history,
      currentDebt: 10000,
      latePaymentCount: 12,
      avgDaysLate: 999,
    })

    const result = calculateRiskScore(profile)
    expect(result.riskScore).toBeLessThanOrEqual(100)
  })

  it("defaultProbability is score/100 clamped to 0.95", () => {
    const history = Array.from({ length: 12 }, () => makePayment("unpaid", 999))

    const profile = buildProfile({
      paymentHistory: history,
      currentDebt: 10000,
      latePaymentCount: 12,
      avgDaysLate: 999,
    })

    const result = calculateRiskScore(profile)
    expect(result.defaultProbability).toBeLessThanOrEqual(0.95)
  })

  it("handles empty payment history", () => {
    const profile = buildProfile({
      paymentHistory: [],
      latePaymentCount: 0,
      avgDaysLate: 0,
    })

    const result = calculateRiskScore(profile)
    expect(result.riskLevel).toBe("low")
    expect(result.riskScore).toBe(0)
  })

  it("assigns points for unpaid invoices (factor 5)", () => {
    const history = [
      makePayment("unpaid", 999),
      makePayment("unpaid", 999),
      makePayment("on_time"),
    ]

    const profile = buildProfile({
      paymentHistory: history,
      latePaymentCount: 2,
      avgDaysLate: 999,
    })

    const result = calculateRiskScore(profile)
    // 2 unpaid -> 10 points from factor 5
    expect(result.riskFactors.some((f) => f.includes("impayée"))).toBe(true)
  })

  it("recommends plan d'apurement for 3 consecutive recent late payments", () => {
    const history = [
      ...Array.from({ length: 9 }, () => makePayment("on_time")),
      makePayment("late", 15),
      makePayment("late", 15),
      makePayment("late", 15),
    ]

    const profile = buildProfile({
      paymentHistory: history,
      latePaymentCount: 3,
      avgDaysLate: 15,
    })

    const result = calculateRiskScore(profile)
    expect(result.recommendations.some((r) => r.includes("plan d'apurement"))).toBe(true)
  })
})

/* ─── collectTenantPaymentData ───────────────────────────────────── */

describe("collectTenantPaymentData", () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it("queries active leases with invoices and returns payment profiles", async () => {
    const now = new Date()
    const dueDate = new Date(now.getFullYear(), now.getMonth() - 1, 5)
    const paidDate = new Date(dueDate)
    paidDate.setDate(paidDate.getDate() + 3)

    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1",
        societyId: "society-1",
        status: "EN_COURS",
        startDate: new Date("2023-01-01"),
        currentRentHT: 900,
        baseRentHT: 800,
        tenant: {
          id: "tenant-1",
          firstName: "Jean",
          lastName: "Dupont",
          companyName: null,
          entityType: "PERSONNE_PHYSIQUE",
        },
        lot: {
          id: "lot-1",
          number: "A1",
          description: "Appartement RDC",
        },
        invoices: [
          {
            id: "inv-1",
            issueDate: dueDate,
            dueDate,
            totalTTC: 900,
            payments: [
              { amount: 900, paidAt: paidDate },
            ],
          },
        ],
      },
    ] as never)

    const result = await collectTenantPaymentData("society-1")

    expect(result).toHaveLength(1)
    expect(result[0].tenantId).toBe("tenant-1")
    expect(result[0].tenantName).toBe("Jean Dupont")
    expect(result[0].lotLabel).toBe("Appartement RDC")
    expect(result[0].monthlyRent).toBe(900)
    expect(result[0].leaseStartDate).toBe("2023-01-01")
    expect(result[0].paymentHistory).toHaveLength(1)
  })

  it("handles company tenants (PERSONNE_MORALE)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-2",
        societyId: "society-1",
        status: "EN_COURS",
        startDate: new Date("2023-06-01"),
        currentRentHT: null,
        baseRentHT: 2000,
        tenant: {
          id: "tenant-2",
          firstName: null,
          lastName: null,
          companyName: "SARL Commerce",
          entityType: "PERSONNE_MORALE",
        },
        lot: {
          id: "lot-2",
          number: "B2",
          description: "",
        },
        invoices: [],
      },
    ] as never)

    const result = await collectTenantPaymentData("society-1")

    expect(result).toHaveLength(1)
    expect(result[0].tenantName).toBe("SARL Commerce")
    expect(result[0].lotLabel).toBe("B2") // falls back to number when description is empty
    expect(result[0].monthlyRent).toBe(2000) // uses baseRentHT when currentRentHT is null
    expect(result[0].paymentHistory).toHaveLength(0)
    expect(result[0].currentDebt).toBe(0)
  })

  it("calculates current debt from partially paid invoices", async () => {
    const dueDate = new Date("2024-02-05")
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-3",
        societyId: "society-1",
        status: "EN_COURS",
        startDate: new Date("2023-01-01"),
        currentRentHT: 1000,
        baseRentHT: 1000,
        tenant: {
          id: "tenant-3",
          firstName: "Marie",
          lastName: "Test",
          companyName: null,
          entityType: "PERSONNE_PHYSIQUE",
        },
        lot: { id: "lot-3", number: "C3", description: "Studio" },
        invoices: [
          {
            id: "inv-2",
            issueDate: dueDate,
            dueDate,
            totalTTC: 1000,
            payments: [{ amount: 600, paidAt: new Date("2024-02-10") }],
          },
        ],
      },
    ] as never)

    const result = await collectTenantPaymentData("society-1")

    expect(result[0].currentDebt).toBe(400)
  })
})

/* ─── predictWithAI ──────────────────────────────────────────────── */

describe("predictWithAI", () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it("returns AI-enhanced predictions when API key is available", async () => {
    const aiResults: Partial<PredictionResult>[] = [
      {
        riskScore: 45,
        riskLevel: "high",
        defaultProbability: 0.42,
        predictedDaysLate: 12,
        riskFactors: ["Retards fréquents ces 3 derniers mois"],
        recommendations: ["Contacter le locataire"],
      },
    ]
    mockCreate.mockResolvedValue(makeAnthropicResponse(aiResults))

    const profiles = [buildProfile({ latePaymentCount: 3 })]
    const results = await predictWithAI(profiles)

    expect(results).toHaveLength(1)
    expect(results[0].riskScore).toBe(45)
    expect(results[0].riskLevel).toBe("high")
    expect(results[0].defaultProbability).toBe(0.42)
    expect(results[0].tenantId).toBe("tenant-1")
    expect(results[0].tenantName).toBe("Jean Locataire")
  })

  it("falls back to rule-based scoring when AI fails", async () => {
    mockCreate.mockRejectedValue(new Error("API error"))

    const profiles = [buildProfile()]
    const results = await predictWithAI(profiles)

    expect(results).toHaveLength(1)
    // Should produce rule-based result (no debt, no late payments = low risk)
    expect(results[0].riskLevel).toBe("low")
  })

  it("falls back to rule-based scoring when API key is missing", async () => {
    const envModule = await import("@/lib/env")
    const original = envModule.env.ANTHROPIC_API_KEY
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(envModule.env as any).ANTHROPIC_API_KEY = undefined

    const profiles = [buildProfile()]
    const results = await predictWithAI(profiles)

    expect(results).toHaveLength(1)
    expect(results[0].riskLevel).toBe("low")
    expect(mockCreate).not.toHaveBeenCalled()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(envModule.env as any).ANTHROPIC_API_KEY = original
  })

  it("returns empty array when given no profiles", async () => {
    const results = await predictWithAI([])

    expect(results).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("limits batch to 20 profiles", async () => {
    const profiles = Array.from({ length: 25 }, (_, i) =>
      buildProfile({ tenantId: `tenant-${i}` })
    )

    const aiResults = Array.from({ length: 20 }, () => ({
      riskScore: 10,
      riskLevel: "low",
      defaultProbability: 0.1,
      predictedDaysLate: 0,
      riskFactors: [],
      recommendations: [],
    }))
    mockCreate.mockResolvedValue(makeAnthropicResponse(aiResults))

    const results = await predictWithAI(profiles)

    // Only first 20 are sent to AI
    expect(results).toHaveLength(20)
  })

  it("uses rule-based fallback for individual profiles when AI result is missing", async () => {
    // AI returns only 1 result for 2 profiles
    const aiResults = [
      {
        riskScore: 55,
        riskLevel: "high",
        defaultProbability: 0.55,
        predictedDaysLate: 15,
        riskFactors: ["Analyse IA"],
        recommendations: ["Action IA"],
      },
    ]
    mockCreate.mockResolvedValue(makeAnthropicResponse(aiResults))

    const profiles = [
      buildProfile({ tenantId: "tenant-1" }),
      buildProfile({ tenantId: "tenant-2" }),
    ]

    const results = await predictWithAI(profiles)

    expect(results).toHaveLength(2)
    // First profile uses AI result
    expect(results[0].riskScore).toBe(55)
    // Second profile falls back to rule-based
    expect(results[1].tenantId).toBe("tenant-2")
    expect(results[1].riskLevel).toBe("low") // default rule-based for clean profile
  })

  it("validates AI response fields and falls back to rule-based for invalid values", async () => {
    const aiResults = [
      {
        riskScore: "not a number",
        riskLevel: "invalid_level",
        defaultProbability: "nope",
        predictedDaysLate: "bad",
        riskFactors: "not an array",
        recommendations: null,
      },
    ]
    mockCreate.mockResolvedValue(makeAnthropicResponse(aiResults))

    const profiles = [buildProfile()]
    const results = await predictWithAI(profiles)

    expect(results).toHaveLength(1)
    // All fields should fall back to rule-based values
    const result = results[0]
    expect(typeof result.riskScore).toBe("number")
    expect(["low", "medium", "high", "critical"]).toContain(result.riskLevel)
    expect(typeof result.defaultProbability).toBe("number")
    expect(Array.isArray(result.riskFactors)).toBe(true)
    expect(Array.isArray(result.recommendations)).toBe(true)
  })
})
