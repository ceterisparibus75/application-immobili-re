import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { prismaMock } from "@/test/mocks/prisma"
import { UserRole } from "@/generated/prisma/client"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

const validLoanInput = {
  label: "Emprunt immeuble A",
  lender: "Banque Populaire",
  loanType: "AMORTISSABLE" as const,
  amount: 100000,
  interestRate: 3.5,
  insuranceRate: 0.36,
  durationMonths: 12,
  startDate: "2025-01-01",
  buildingId: VALID_CUID,
}

// Lazy imports to ensure mocks are in place
const importActions = async () => import("@/actions/loan")

// ---------------------------------------------------------------------------
// createLoan
// ---------------------------------------------------------------------------
describe("createLoan", () => {
  it("returns error when unauthenticated", async () => {
    mockUnauthenticated()
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", validLoanInput)
    expect(r.error).toBe("Non authentifié")
  })

  it("returns error when role is LECTURE (below GESTIONNAIRE)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", validLoanInput)
    expect(r.error).toBe("Accès refusé")
  })

  it("returns error when label is empty", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, label: "" })
    expect(r.error).toBeDefined()
  })

  it("returns error when amount is zero", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, amount: 0 })
    expect(r.error).toBeDefined()
  })

  it("returns error when amount is negative", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, amount: -5000 })
    expect(r.error).toBeDefined()
  })

  it("returns error when interestRate is negative", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, interestRate: -1 })
    expect(r.error).toBeDefined()
  })

  it("returns error when durationMonths is zero", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, durationMonths: 0 })
    expect(r.error).toBeDefined()
  })

  it("returns error when startDate is empty", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, startDate: "" })
    expect(r.error).toBeDefined()
  })

  it("returns error when buildingId is empty", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, buildingId: "" })
    expect(r.error).toBeDefined()
  })

  it("returns error when loanType is invalid", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, loanType: "INVALID" })
    expect(r.error).toBeDefined()
  })

  it("returns error when lender is empty", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const { createLoan } = await importActions()
    const r = await createLoan("society-1", { ...validLoanInput, lender: "" })
    expect(r.error).toBeDefined()
  })

  // --- AMORTISSABLE success ---
  it("creates AMORTISSABLE loan with correct amortization lines", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const createdLoan = { id: "loan-1", label: validLoanInput.label }
    prismaMock.loan.create.mockResolvedValue(createdLoan as never)

    const { createLoan } = await importActions()
    const r = await createLoan("society-1", validLoanInput)

    expect(r.data).toBeDefined()
    expect(r.error).toBeUndefined()

    // Verify prisma.loan.create was called with amortizationLines
    const createCall = prismaMock.loan.create.mock.calls[0][0] as {
      data: { amortizationLines: { create: Array<{ period: number; remainingBalance: number; principalPayment: number }> } }
    }
    const lines = createCall.data.amortizationLines.create
    expect(lines).toHaveLength(12)
    // Last line remaining balance should be 0
    expect(lines[lines.length - 1].remainingBalance).toBe(0)
    // All principal payments should be positive
    for (const line of lines) {
      expect(line.principalPayment).toBeGreaterThanOrEqual(0)
    }
    // Sum of principal payments should approximately equal the loan amount
    const totalPrincipal = lines.reduce(
      (sum: number, l: { principalPayment: number }) => sum + l.principalPayment, 0
    )
    expect(totalPrincipal).toBeCloseTo(100000, 0)
  })

  // --- AMORTISSABLE with 0% interest ---
  it("creates AMORTISSABLE loan with zero interest rate (even split)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.create.mockResolvedValue({ id: "loan-2" } as never)

    const { createLoan } = await importActions()
    const input = { ...validLoanInput, interestRate: 0, insuranceRate: 0, durationMonths: 4, amount: 1000 }
    const r = await createLoan("society-1", input)

    expect(r.data).toBeDefined()
    const createCall = prismaMock.loan.create.mock.calls[0][0] as {
      data: { amortizationLines: { create: Array<{ principalPayment: number; interestPayment: number }> } }
    }
    const lines = createCall.data.amortizationLines.create
    expect(lines).toHaveLength(4)
    // Each principal payment should be 250
    expect(lines[0].principalPayment).toBeCloseTo(250, 2)
    // Interest should be 0
    for (const line of lines) {
      expect(line.interestPayment).toBe(0)
    }
  })

  // --- AMORTISSABLE: PMT formula verification ---
  it("creates AMORTISSABLE loan with correct PMT calculation", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.create.mockResolvedValue({ id: "loan-pmt" } as never)

    const { createLoan } = await importActions()
    // 100000 at 6% for 12 months
    const input = { ...validLoanInput, amount: 100000, interestRate: 6, insuranceRate: 0, durationMonths: 12 }
    const r = await createLoan("society-1", input)

    expect(r.data).toBeDefined()
    const createCall = prismaMock.loan.create.mock.calls[0][0] as {
      data: { amortizationLines: { create: Array<{ totalPayment: number; interestPayment: number; principalPayment: number; remainingBalance: number }> } }
    }
    const lines = createCall.data.amortizationLines.create

    // PMT = P * r(1+r)^n / ((1+r)^n - 1) where r = 6/100/12 = 0.005
    const r_rate = 0.005
    const n = 12
    const expectedPmt = 100000 * r_rate * Math.pow(1 + r_rate, n) / (Math.pow(1 + r_rate, n) - 1)

    // First line: interest = 100000 * 0.005 = 500
    expect(lines[0].interestPayment).toBeCloseTo(500, 2)
    // Total payment should be close to PMT
    expect(lines[0].totalPayment).toBeCloseTo(expectedPmt, 0)

    // Decreasing interest over time
    expect(lines[0].interestPayment).toBeGreaterThan(lines[11].interestPayment)
    // Increasing principal over time
    expect(lines[0].principalPayment).toBeLessThan(lines[10].principalPayment)
  })

  // --- IN_FINE success ---
  it("creates IN_FINE loan (interest-only + bullet principal at end)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.create.mockResolvedValue({ id: "loan-3" } as never)

    const { createLoan } = await importActions()
    const input = { ...validLoanInput, loanType: "IN_FINE" as const, durationMonths: 6, amount: 120000, interestRate: 6, insuranceRate: 0 }
    const r = await createLoan("society-1", input)

    expect(r.data).toBeDefined()
    const createCall = prismaMock.loan.create.mock.calls[0][0] as {
      data: { amortizationLines: { create: Array<{ period: number; principalPayment: number; interestPayment: number; remainingBalance: number }> } }
    }
    const lines = createCall.data.amortizationLines.create
    expect(lines).toHaveLength(6)

    // Monthly interest = 120000 * 6/100/12 = 600
    const monthlyInterest = 120000 * 0.06 / 12
    // Periods 1-5: interest only, no principal, remaining = full amount
    for (let i = 0; i < 5; i++) {
      expect(lines[i].principalPayment).toBe(0)
      expect(lines[i].interestPayment).toBeCloseTo(monthlyInterest, 2)
      expect(lines[i].remainingBalance).toBe(120000)
    }
    // Last period: full principal + interest
    expect(lines[5].principalPayment).toBe(120000)
    expect(lines[5].remainingBalance).toBe(0)
  })

  // --- IN_FINE with insurance ---
  it("creates IN_FINE loan with insurance included each month", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.create.mockResolvedValue({ id: "loan-inf-ins" } as never)

    const { createLoan } = await importActions()
    const input = { ...validLoanInput, loanType: "IN_FINE" as const, durationMonths: 3, amount: 60000, interestRate: 12, insuranceRate: 1.2 }
    const r = await createLoan("society-1", input)

    expect(r.data).toBeDefined()
    const createCall = prismaMock.loan.create.mock.calls[0][0] as {
      data: { amortizationLines: { create: Array<{ insurancePayment: number; totalPayment: number; principalPayment: number }> } }
    }
    const lines = createCall.data.amortizationLines.create
    // Monthly insurance = 60000 * 1.2/100/12 = 60
    // Monthly interest = 60000 * 12/100/12 = 600
    for (let i = 0; i < 2; i++) {
      expect(lines[i].insurancePayment).toBeCloseTo(60, 2)
      expect(lines[i].totalPayment).toBeCloseTo(600 + 60, 2) // interest + insurance, no principal
    }
    // Last period: principal + interest + insurance
    expect(lines[2].totalPayment).toBeCloseTo(60000 + 600 + 60, 2)
  })

  // --- BULLET success ---
  it("creates BULLET loan (single payment at maturity)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.create.mockResolvedValue({ id: "loan-4" } as never)

    const { createLoan } = await importActions()
    const input = { ...validLoanInput, loanType: "BULLET" as const, durationMonths: 24, amount: 50000, interestRate: 4, insuranceRate: 0.5 }
    const r = await createLoan("society-1", input)

    expect(r.data).toBeDefined()
    const createCall = prismaMock.loan.create.mock.calls[0][0] as {
      data: { amortizationLines: { create: Array<{ period: number; principalPayment: number; interestPayment: number; insurancePayment: number; totalPayment: number; remainingBalance: number }> } }
    }
    const lines = createCall.data.amortizationLines.create
    expect(lines).toHaveLength(1)

    const line = lines[0]
    expect(line.period).toBe(1)
    expect(line.principalPayment).toBe(50000)
    // Interest = 50000 * 4/100 * 2 years = 4000
    expect(line.interestPayment).toBeCloseTo(4000, 2)
    // Insurance = 50000 * 0.5/100 * 2 years = 500
    expect(line.insurancePayment).toBeCloseTo(500, 2)
    expect(line.remainingBalance).toBe(0)
    expect(line.totalPayment).toBeCloseTo(50000 + 4000 + 500, 2)
  })

  // --- AMORTISSABLE: last period adjusts for rounding ---
  it("creates AMORTISSABLE loan where last period soldes remaining balance", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.create.mockResolvedValue({ id: "loan-round" } as never)

    const { createLoan } = await importActions()
    // Use a case likely to have rounding issues
    const input = { ...validLoanInput, amount: 10000, interestRate: 5.5, insuranceRate: 0, durationMonths: 36 }
    const r = await createLoan("society-1", input)

    expect(r.data).toBeDefined()
    const createCall = prismaMock.loan.create.mock.calls[0][0] as {
      data: { amortizationLines: { create: Array<{ remainingBalance: number; principalPayment: number }> } }
    }
    const lines = createCall.data.amortizationLines.create
    expect(lines).toHaveLength(36)
    // Last line must have exactly 0 remaining balance
    expect(lines[35].remainingBalance).toBe(0)
    // Total principal must be the original amount
    const totalPrincipal = lines.reduce(
      (sum: number, l: { principalPayment: number }) => sum + l.principalPayment, 0
    )
    expect(totalPrincipal).toBeCloseTo(10000, 0)
  })
})

// ---------------------------------------------------------------------------
// getLoans
// ---------------------------------------------------------------------------
describe("getLoans", () => {
  it("returns empty array when unauthenticated", async () => {
    mockUnauthenticated()
    const { getLoans } = await importActions()
    const r = await getLoans("society-1")
    expect(r).toEqual([])
  })

  it("returns loans with building info for LECTURE role", async () => {
    mockAuthSession(UserRole.LECTURE)
    const loans = [{ id: "loan-1", label: "Emprunt A", building: { id: "b1", name: "Immeuble A", city: "Paris" } }]
    prismaMock.loan.findMany.mockResolvedValue(loans as never)

    const { getLoans } = await importActions()
    const r = await getLoans("society-1")
    expect(r).toEqual(loans)
    expect(prismaMock.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "society-1" } })
    )
  })
})

// ---------------------------------------------------------------------------
// getLoanById
// ---------------------------------------------------------------------------
describe("getLoanById", () => {
  it("returns null when unauthenticated", async () => {
    mockUnauthenticated()
    const { getLoanById } = await importActions()
    const r = await getLoanById("society-1", "loan-1")
    expect(r).toBeNull()
  })

  it("returns null when loan not found", async () => {
    mockAuthSession(UserRole.LECTURE)
    prismaMock.loan.findFirst.mockResolvedValue(null)

    const { getLoanById } = await importActions()
    const r = await getLoanById("society-1", "loan-1")
    expect(r).toBeNull()
  })

  it("returns loan with amortization lines on success", async () => {
    mockAuthSession(UserRole.LECTURE)
    const loan = { id: "loan-1", label: "Emprunt A", amortizationLines: [{ period: 1 }] }
    prismaMock.loan.findFirst.mockResolvedValue(loan as never)

    const { getLoanById } = await importActions()
    const r = await getLoanById("society-1", "loan-1")
    expect(r).toEqual(loan)
    expect(prismaMock.loan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "loan-1", societyId: "society-1" } })
    )
  })
})

// ---------------------------------------------------------------------------
// markAmortizationLinePaid
// ---------------------------------------------------------------------------
describe("markAmortizationLinePaid", () => {
  it("returns error when unauthenticated", async () => {
    mockUnauthenticated()
    const { markAmortizationLinePaid } = await importActions()
    const r = await markAmortizationLinePaid("society-1", "line-1", true)
    expect(r.error).toBe("Non authentifié")
  })

  it("returns error when role is LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const { markAmortizationLinePaid } = await importActions()
    const r = await markAmortizationLinePaid("society-1", "line-1", true)
    expect(r.error).toBe("Accès refusé")
  })

  it("returns error when line not found", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue(null)

    const { markAmortizationLinePaid } = await importActions()
    const r = await markAmortizationLinePaid("society-1", "line-1", true)
    expect(r.error).toBe("Ligne introuvable")
  })

  it("sets isPaid=true and paidAt when marking paid", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue({ id: "line-1", loanId: "loan-1" } as never)
    prismaMock.loanAmortizationLine.update.mockResolvedValue({} as never)

    const { markAmortizationLinePaid } = await importActions()
    const r = await markAmortizationLinePaid("society-1", "line-1", true)
    expect(r.success).toBe(true)
    expect(prismaMock.loanAmortizationLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "line-1" },
        data: expect.objectContaining({ isPaid: true }),
      })
    )
    // paidAt should be a Date when paid=true
    const updateData = prismaMock.loanAmortizationLine.update.mock.calls[0][0].data as { paidAt: Date | null }
    expect(updateData.paidAt).toBeInstanceOf(Date)
  })

  it("sets isPaid=false and paidAt=null when unmarking", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue({ id: "line-1", loanId: "loan-1" } as never)
    prismaMock.loanAmortizationLine.update.mockResolvedValue({} as never)

    const { markAmortizationLinePaid } = await importActions()
    const r = await markAmortizationLinePaid("society-1", "line-1", false)
    expect(r.success).toBe(true)
    expect(prismaMock.loanAmortizationLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: false, paidAt: null }),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// deleteLoan
// ---------------------------------------------------------------------------
describe("deleteLoan", () => {
  it("returns error when unauthenticated", async () => {
    mockUnauthenticated()
    const { deleteLoan } = await importActions()
    const r = await deleteLoan("society-1", "loan-1")
    expect(r.error).toBe("Non authentifié")
  })

  it("returns error when role is LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const { deleteLoan } = await importActions()
    const r = await deleteLoan("society-1", "loan-1")
    expect(r.error).toBe("Accès refusé")
  })

  it("returns error when loan not found", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.findFirst.mockResolvedValue(null)

    const { deleteLoan } = await importActions()
    const r = await deleteLoan("society-1", "loan-1")
    expect(r.error).toBe("Emprunt introuvable")
  })

  it("deletes loan with cascade on success", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.findFirst.mockResolvedValue({ id: "loan-1", label: "Test" } as never)
    prismaMock.loan.delete.mockResolvedValue({} as never)

    const { deleteLoan } = await importActions()
    const r = await deleteLoan("society-1", "loan-1")
    expect(r.success).toBe(true)
    expect(prismaMock.loan.delete).toHaveBeenCalledWith({ where: { id: "loan-1" } })
  })
})

// ---------------------------------------------------------------------------
// regenerateAmortizationTable
// ---------------------------------------------------------------------------
describe("regenerateAmortizationTable", () => {
  it("returns error when unauthenticated", async () => {
    mockUnauthenticated()
    const { regenerateAmortizationTable } = await importActions()
    const r = await regenerateAmortizationTable("society-1", "loan-1")
    expect(r.error).toBe("Non authentifié")
  })

  it("returns error when role is LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const { regenerateAmortizationTable } = await importActions()
    const r = await regenerateAmortizationTable("society-1", "loan-1")
    expect(r.error).toBe("Accès refusé")
  })

  it("returns error when loan not found", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.loan.findFirst.mockResolvedValue(null)

    const { regenerateAmortizationTable } = await importActions()
    const r = await regenerateAmortizationTable("society-1", "loan-1")
    expect(r.error).toBe("Emprunt introuvable")
  })

  it("regenerates table and preserves paid status", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const loan = {
      id: "loan-1",
      amount: 12000,
      interestRate: 0,
      insuranceRate: 0,
      durationMonths: 3,
      startDate: new Date("2025-01-01"),
      loanType: "AMORTISSABLE",
      label: "Test",
    }
    prismaMock.loan.findFirst.mockResolvedValue(loan as never)

    // Existing lines: period 1 is paid, period 2 and 3 are not
    prismaMock.loanAmortizationLine.findMany.mockResolvedValue([
      { period: 1, isPaid: true, paidAt: new Date("2025-02-01") },
      { period: 2, isPaid: false, paidAt: null },
      { period: 3, isPaid: false, paidAt: null },
    ] as never)
    prismaMock.loanAmortizationLine.deleteMany.mockResolvedValue({ count: 3 } as never)
    prismaMock.loanAmortizationLine.createMany.mockResolvedValue({ count: 3 } as never)

    const { regenerateAmortizationTable } = await importActions()
    const r = await regenerateAmortizationTable("society-1", "loan-1")

    expect(r.success).toBe(true)
    expect(r.data).toEqual({ linesCount: 3 })

    // Verify deleteMany was called for the old lines
    expect(prismaMock.loanAmortizationLine.deleteMany).toHaveBeenCalledWith({ where: { loanId: "loan-1" } })

    // Verify createMany was called with paid status preserved
    const createManyCall = prismaMock.loanAmortizationLine.createMany.mock.calls[0][0] as {
      data: Array<{ period: number; isPaid: boolean; paidAt: Date | null }>
    }
    const newLines = createManyCall.data
    expect(newLines).toHaveLength(3)
    // Period 1 should still be paid
    expect(newLines[0].isPaid).toBe(true)
    expect(newLines[0].paidAt).toBeInstanceOf(Date)
    // Period 2 should not be paid
    expect(newLines[1].isPaid).toBe(false)
    expect(newLines[1].paidAt).toBeNull()
  })

  it("regenerates IN_FINE table correctly", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const loan = {
      id: "loan-inf",
      amount: 50000,
      interestRate: 3,
      insuranceRate: 0,
      durationMonths: 6,
      startDate: new Date("2025-06-01"),
      loanType: "IN_FINE",
      label: "In Fine Test",
    }
    prismaMock.loan.findFirst.mockResolvedValue(loan as never)
    prismaMock.loanAmortizationLine.findMany.mockResolvedValue([] as never)
    prismaMock.loanAmortizationLine.deleteMany.mockResolvedValue({ count: 0 } as never)
    prismaMock.loanAmortizationLine.createMany.mockResolvedValue({ count: 6 } as never)

    const { regenerateAmortizationTable } = await importActions()
    const r = await regenerateAmortizationTable("society-1", "loan-inf")

    expect(r.success).toBe(true)
    expect(r.data).toEqual({ linesCount: 6 })

    const createManyCall = prismaMock.loanAmortizationLine.createMany.mock.calls[0][0] as {
      data: Array<{ period: number; principalPayment: number; remainingBalance: number }>
    }
    const newLines = createManyCall.data
    // First 5 lines: no principal, full remaining
    for (let i = 0; i < 5; i++) {
      expect(newLines[i].principalPayment).toBe(0)
      expect(newLines[i].remainingBalance).toBe(50000)
    }
    // Last line: full principal, zero remaining
    expect(newLines[5].principalPayment).toBe(50000)
    expect(newLines[5].remainingBalance).toBe(0)
  })
})
