import { describe, it, expect } from "vitest"
import { createBuildingSchema, updateBuildingSchema } from "@/validations/building"

describe("createBuildingSchema", () => {
  const validBuilding = {
    name: "Immeuble Central",
    addressLine1: "10 rue de la Paix",
    city: "Paris",
    postalCode: "75001",
    buildingType: "BUREAU" as const,
  }

  it("valide un immeuble minimal", () => {
    expect(createBuildingSchema.safeParse(validBuilding).success).toBe(true)
  })

  it("valide un immeuble avec tous les champs optionnels", () => {
    const full = {
      ...validBuilding,
      addressLine2: "Bâtiment B",
      country: "France",
      yearBuilt: 2005,
      totalArea: 1500,
      marketValue: 2000000,
      netBookValue: 1500000,
      acquisitionPrice: 1800000,
      acquisitionFees: 50000,
      acquisitionTaxes: 30000,
      acquisitionOtherCosts: 10000,
      acquisitionDate: "2020-01-15",
      description: "Immeuble de bureaux",
    }
    expect(createBuildingSchema.safeParse(full).success).toBe(true)
  })

  it("echoue si name trop court (< 2)", () => {
    const result = createBuildingSchema.safeParse({ ...validBuilding, name: "A" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("2 caractères")
    }
  })

  it("echoue si addressLine1 trop courte (< 5)", () => {
    const result = createBuildingSchema.safeParse({ ...validBuilding, addressLine1: "abc" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("adresse")
    }
  })

  it("echoue si city trop courte (< 2)", () => {
    const result = createBuildingSchema.safeParse({ ...validBuilding, city: "P" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("ville")
    }
  })

  it("echoue si postalCode n'est pas 5 chiffres", () => {
    expect(createBuildingSchema.safeParse({ ...validBuilding, postalCode: "123" }).success).toBe(false)
    expect(createBuildingSchema.safeParse({ ...validBuilding, postalCode: "ABCDE" }).success).toBe(false)
    expect(createBuildingSchema.safeParse({ ...validBuilding, postalCode: "123456" }).success).toBe(false)
  })

  it("accepte un postalCode valide de 5 chiffres", () => {
    expect(createBuildingSchema.safeParse({ ...validBuilding, postalCode: "75001" }).success).toBe(true)
    expect(createBuildingSchema.safeParse({ ...validBuilding, postalCode: "01000" }).success).toBe(true)
  })

  it("echoue si buildingType invalide", () => {
    const result = createBuildingSchema.safeParse({ ...validBuilding, buildingType: "MAISON" })
    expect(result.success).toBe(false)
  })

  it("accepte les 4 types valides", () => {
    for (const t of ["BUREAU", "COMMERCE", "MIXTE", "ENTREPOT"]) {
      expect(createBuildingSchema.safeParse({ ...validBuilding, buildingType: t }).success).toBe(true)
    }
  })

  it("echoue si yearBuilt < 1800", () => {
    const result = createBuildingSchema.safeParse({ ...validBuilding, yearBuilt: 1799 })
    expect(result.success).toBe(false)
  })

  it("echoue si yearBuilt > année courante", () => {
    const result = createBuildingSchema.safeParse({ ...validBuilding, yearBuilt: new Date().getFullYear() + 1 })
    expect(result.success).toBe(false)
  })

  it("accepte yearBuilt dans la plage valide", () => {
    expect(createBuildingSchema.safeParse({ ...validBuilding, yearBuilt: 1800 }).success).toBe(true)
    expect(createBuildingSchema.safeParse({ ...validBuilding, yearBuilt: new Date().getFullYear() }).success).toBe(true)
  })

  it("accepte les champs optionnels omis (marketValue, description)", () => {
    const result = createBuildingSchema.safeParse(validBuilding)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.marketValue).toBeUndefined()
      expect(result.data.description).toBeUndefined()
    }
  })

  it("applique le defaut 'France' pour country", () => {
    const result = createBuildingSchema.safeParse(validBuilding)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.country).toBe("France")
    }
  })

  it("coerce yearBuilt depuis une string", () => {
    const result = createBuildingSchema.safeParse({ ...validBuilding, yearBuilt: "2005" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.yearBuilt).toBe(2005)
    }
  })
})

describe("updateBuildingSchema", () => {
  it("exige un id CUID", () => {
    const result = updateBuildingSchema.safeParse({ id: "not-a-cuid" })
    expect(result.success).toBe(false)
  })

  it("accepte un update partiel avec id valide", () => {
    const result = updateBuildingSchema.safeParse({ id: "clh3x2z4k0000qh8g7z1y2v3t", name: "Nouveau nom" })
    expect(result.success).toBe(true)
  })

  it("accepte un update avec seulement l'id", () => {
    const result = updateBuildingSchema.safeParse({ id: "clh3x2z4k0000qh8g7z1y2v3t" })
    expect(result.success).toBe(true)
  })
})
