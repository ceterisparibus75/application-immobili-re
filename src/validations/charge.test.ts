import { describe, it, expect } from "vitest"
import {
  createChargeSchema,
  createChargeCategorySchema,
} from "@/validations/charge"

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

describe("createChargeSchema", () => {
  const validCharge = {
    buildingId: VALID_CUID,
    categoryId: VALID_CUID,
    description: "Entretien parties communes",
    amount: 250.5,
    date: "2024-03-15",
    periodStart: "2024-01-01",
    periodEnd: "2024-03-31",
  }

  it("valide une charge correcte", () => {
    const result = createChargeSchema.safeParse(validCharge)
    expect(result.success).toBe(true)
  })

  it("echoue si amount est negatif", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, amount: -10 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("positif")
    }
  })

  it("accepte amount egal a 0", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, amount: 0 })
    expect(result.success).toBe(true)
  })

  it("coerce amount depuis une string", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, amount: "250.5" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.amount).toBe(250.5)
    }
  })

  it("echoue si description manquante", () => {
    const { description: _, ...noDesc } = validCharge
    const result = createChargeSchema.safeParse(noDesc)
    expect(result.success).toBe(false)
  })

  it("echoue si description est vide", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, description: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si buildingId manquant", () => {
    const { buildingId: _, ...noBuildingId } = validCharge
    const result = createChargeSchema.safeParse(noBuildingId)
    expect(result.success).toBe(false)
  })

  it("echoue si categoryId manquant", () => {
    const { categoryId: _, ...noCatId } = validCharge
    const result = createChargeSchema.safeParse(noCatId)
    expect(result.success).toBe(false)
  })

  it("echoue si date manquante", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, date: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si periodStart manquante", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, periodStart: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si periodEnd manquante", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, periodEnd: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si buildingId n'est pas un CUID", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, buildingId: "not-a-cuid" })
    expect(result.success).toBe(false)
  })

  it("echoue si categoryId n'est pas un CUID", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, categoryId: "invalid" })
    expect(result.success).toBe(false)
  })

  describe("isPaid transform", () => {
    it("transforme true (boolean) en true", () => {
      const result = createChargeSchema.safeParse({ ...validCharge, isPaid: true })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPaid).toBe(true)
      }
    })

    it("transforme false (boolean) en false", () => {
      const result = createChargeSchema.safeParse({ ...validCharge, isPaid: false })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPaid).toBe(false)
      }
    })

    it('transforme "true" (string) en true', () => {
      const result = createChargeSchema.safeParse({ ...validCharge, isPaid: "true" })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPaid).toBe(true)
      }
    })

    it('transforme "on" (string) en true', () => {
      const result = createChargeSchema.safeParse({ ...validCharge, isPaid: "on" })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPaid).toBe(true)
      }
    })

    it('transforme "false" (string) en false', () => {
      const result = createChargeSchema.safeParse({ ...validCharge, isPaid: "false" })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPaid).toBe(false)
      }
    })

    it("default isPaid a false si omis", () => {
      const result = createChargeSchema.safeParse(validCharge)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isPaid).toBe(false)
      }
    })
  })

  it("accepte supplierName optionnel", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, supplierName: "Fournisseur ABC" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.supplierName).toBe("Fournisseur ABC")
    }
  })

  it("accepte supplierName null", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, supplierName: null })
    expect(result.success).toBe(true)
  })

  it("accepte invoiceUrl valide", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, invoiceUrl: "https://example.com/invoice.pdf" })
    expect(result.success).toBe(true)
  })

  it("echoue si invoiceUrl n'est pas une URL valide", () => {
    const result = createChargeSchema.safeParse({ ...validCharge, invoiceUrl: "not-a-url" })
    expect(result.success).toBe(false)
  })
})

describe("createChargeCategorySchema", () => {
  const validCategory = {
    buildingId: VALID_CUID,
    name: "Electricite",
    nature: "RECUPERABLE" as const,
  }

  it("valide une categorie correcte", () => {
    const result = createChargeCategorySchema.safeParse(validCategory)
    expect(result.success).toBe(true)
  })

  it("applique le defaut recoverableRate a 100", () => {
    const result = createChargeCategorySchema.safeParse(validCategory)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recoverableRate).toBe(100)
    }
  })

  it("applique le defaut allocationMethod a TANTIEME", () => {
    const result = createChargeCategorySchema.safeParse(validCategory)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.allocationMethod).toBe("TANTIEME")
    }
  })

  it("echoue si nature invalide", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, nature: "INVALIDE" })
    expect(result.success).toBe(false)
  })

  it("accepte les 3 natures valides", () => {
    for (const nature of ["PROPRIETAIRE", "RECUPERABLE", "MIXTE"] as const) {
      const result = createChargeCategorySchema.safeParse({ ...validCategory, nature })
      expect(result.success).toBe(true)
    }
  })

  it("echoue si recoverableRate < 0", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, recoverableRate: -1 })
    expect(result.success).toBe(false)
  })

  it("echoue si recoverableRate > 100", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, recoverableRate: 101 })
    expect(result.success).toBe(false)
  })

  it("accepte recoverableRate a 0", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, recoverableRate: 0 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recoverableRate).toBe(0)
    }
  })

  it("accepte recoverableRate a 100", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, recoverableRate: 100 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recoverableRate).toBe(100)
    }
  })

  it("coerce recoverableRate depuis une string", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, recoverableRate: "75" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recoverableRate).toBe(75)
    }
  })

  it("echoue si name est vide", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, name: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si name manquant", () => {
    const { name: _, ...noName } = validCategory
    const result = createChargeCategorySchema.safeParse(noName)
    expect(result.success).toBe(false)
  })

  it("echoue si buildingId invalide", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, buildingId: "invalid" })
    expect(result.success).toBe(false)
  })

  it("accepte description optionnelle", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, description: "Description" })
    expect(result.success).toBe(true)
  })

  it("accepte description null", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, description: null })
    expect(result.success).toBe(true)
  })

  it("accepte les 5 methodes d'allocation valides", () => {
    for (const method of ["TANTIEME", "SURFACE", "NB_LOTS", "COMPTEUR", "PERSONNALISE"] as const) {
      const result = createChargeCategorySchema.safeParse({ ...validCategory, allocationMethod: method })
      expect(result.success).toBe(true)
    }
  })

  it("echoue si allocationMethod invalide", () => {
    const result = createChargeCategorySchema.safeParse({ ...validCategory, allocationMethod: "INVALIDE" })
    expect(result.success).toBe(false)
  })
})
