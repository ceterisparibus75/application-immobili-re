import { describe, it, expect } from "vitest"
import { createTenantSchema } from "@/validations/tenant"

describe("createTenantSchema - PERSONNE_PHYSIQUE", () => {
  const validPhysique = {
    entityType: "PERSONNE_PHYSIQUE" as const,
    lastName: "Dupont", firstName: "Jean",
    email: "jean.dupont@example.com",
  }

  it("valide une personne physique minimale", () => {
    expect(createTenantSchema.safeParse(validPhysique).success).toBe(true)
  })

  it("echoue si lastName manquant", () => {
    expect(createTenantSchema.safeParse({ ...validPhysique, lastName: "" }).success).toBe(false)
  })

  it("echoue si email invalide", () => {
    expect(createTenantSchema.safeParse({ ...validPhysique, email: "pas-un-email" }).success).toBe(false)
  })
})

describe("createTenantSchema - PERSONNE_MORALE", () => {
  const validMorale = {
    entityType: "PERSONNE_MORALE" as const,
    companyName: "Ma SARL",
    email: "contact@masarl.fr",
  }

  it("valide une personne morale minimale", () => {
    expect(createTenantSchema.safeParse(validMorale).success).toBe(true)
  })

  it("echoue si companyName manquant", () => {
    expect(createTenantSchema.safeParse({ ...validMorale, companyName: "" }).success).toBe(false)
  })

  it("echoue si SIRET invalide (pas 14 chiffres)", () => {
    expect(createTenantSchema.safeParse({ ...validMorale, siret: "123" }).success).toBe(false)
  })
})
