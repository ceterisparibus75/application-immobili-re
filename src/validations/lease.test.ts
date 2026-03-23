import { describe, it, expect } from "vitest"
import { createLeaseSchema } from "@/validations/lease"

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

const validLease = {
  lotId: VALID_CUID,
  tenantId: VALID_CUID,
  leaseType: "COMMERCIAL_369" as const,
  startDate: "2024-01-01",
  baseRentHT: 1500,
}

describe("createLeaseSchema", () => {
  it("valide un bail minimal correct", () => {
    const result = createLeaseSchema.safeParse(validLease)
    expect(result.success).toBe(true)
  })

  it("echoue si lotId manquant", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, lotId: undefined })
    expect(result.success).toBe(false)
  })

  it("echoue si leaseType invalide", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, leaseType: "INCONNU" })
    expect(result.success).toBe(false)
  })

  it("coerce baseRentHT depuis string", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, baseRentHT: "1500" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.baseRentHT).toBe(1500)
  })

  it("echoue si baseRentHT negatif", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, baseRentHT: -100 })
    expect(result.success).toBe(false)
  })
})
