import { describe, it, expect } from "vitest"
import {
  createLeaseSchema,
  updateLeaseSchema,
  createRentStepsSchema,
  updateRentStepSchema,
  getLeaseCategory,
  getDefaultDuration,
  getDefaultIndexType,
  getDefaultVat,
  getDefaultDepositMonths,
} from "@/validations/lease"

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const VALID_CUID2 = "clh3x2z4k0001qh8g7z1y2v3u"

const validLease = {
  lotIds: [VALID_CUID],
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

  it("valide un bail avec plusieurs lots", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, lotIds: [VALID_CUID, VALID_CUID2] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.lotIds).toHaveLength(2)
  })

  it("echoue si lotIds vide", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, lotIds: [] })
    expect(result.success).toBe(false)
  })

  it("echoue si lotIds manquant", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, lotIds: undefined })
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

  it("transforme vatApplicable 'true' en booléen true", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, vatApplicable: "true" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.vatApplicable).toBe(true)
  })

  it("transforme vatApplicable 'on' en booléen true", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, vatApplicable: "on" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.vatApplicable).toBe(true)
  })

  it("transforme vatApplicable false en false", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, vatApplicable: false })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.vatApplicable).toBe(false)
  })
})

describe("updateLeaseSchema", () => {
  it("valide une mise à jour partielle avec id uniquement", () => {
    const result = updateLeaseSchema.safeParse({ id: VALID_CUID, baseRentHT: 900 })
    expect(result.success).toBe(true)
  })

  it("rejette si id manquant", () => {
    const result = updateLeaseSchema.safeParse({ baseRentHT: 900 })
    expect(result.success).toBe(false)
  })

  it("transforme vatApplicable string en booléen", () => {
    const result = updateLeaseSchema.safeParse({ id: VALID_CUID, vatApplicable: "true" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.vatApplicable).toBe(true)
  })

  it("accepte status RESILIE", () => {
    const result = updateLeaseSchema.safeParse({ id: VALID_CUID, status: "RESILIE" })
    expect(result.success).toBe(true)
  })

  it("rejette un status invalide", () => {
    const result = updateLeaseSchema.safeParse({ id: VALID_CUID, status: "INCONNU" })
    expect(result.success).toBe(false)
  })
})

describe("createRentStepsSchema", () => {
  it("valide un palier unique sans date de fin", () => {
    const result = createRentStepsSchema.safeParse({
      leaseId: VALID_CUID,
      steps: [{ label: "Palier 1", startDate: "2025-01-01", rentHT: 800 }],
    })
    expect(result.success).toBe(true)
  })

  it("valide deux paliers sans chevauchement", () => {
    const result = createRentStepsSchema.safeParse({
      leaseId: VALID_CUID,
      steps: [
        { label: "Palier 1", startDate: "2025-01-01", endDate: "2025-12-31", rentHT: 800 },
        { label: "Palier 2", startDate: "2026-01-01", rentHT: 900 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("rejette si steps est vide", () => {
    const result = createRentStepsSchema.safeParse({ leaseId: VALID_CUID, steps: [] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.errors[0].message).toBe("Au moins un palier est requis")
  })

  it("rejette si date de fin avant date de début", () => {
    const result = createRentStepsSchema.safeParse({
      leaseId: VALID_CUID,
      steps: [{ label: "Palier A", startDate: "2025-06-01", endDate: "2025-01-01", rentHT: 800 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.errors[0].message).toContain("postérieure à la date de début")
  })

  it("rejette si deux paliers se chevauchent", () => {
    const result = createRentStepsSchema.safeParse({
      leaseId: VALID_CUID,
      steps: [
        { label: "Palier 1", startDate: "2025-01-01", endDate: "2025-06-30", rentHT: 800 },
        { label: "Palier 2", startDate: "2025-06-01", rentHT: 900 },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.errors[0].message).toContain("chevauchent")
  })

  it("rejette si palier intermédiaire sans date de fin", () => {
    const result = createRentStepsSchema.safeParse({
      leaseId: VALID_CUID,
      steps: [
        { label: "Palier 1", startDate: "2025-01-01", rentHT: 800 },
        { label: "Palier 2", startDate: "2026-01-01", rentHT: 900 },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.errors[0].message).toContain("date de fin car un palier suivant existe")
  })
})

describe("updateRentStepSchema", () => {
  it("valide une mise à jour complète", () => {
    const result = updateRentStepSchema.safeParse({
      id: VALID_CUID,
      label: "Palier mis à jour",
      startDate: "2025-01-01",
      rentHT: 950,
    })
    expect(result.success).toBe(true)
  })

  it("rejette si label est vide", () => {
    const result = updateRentStepSchema.safeParse({
      id: VALID_CUID,
      label: "",
      startDate: "2025-01-01",
      rentHT: 950,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.errors[0].message).toBe("Le libellé est requis")
  })
})

describe("getLeaseCategory", () => {
  it("retourne HABITATION pour les types résidentiels", () => {
    const habitation = ["HABITATION", "MEUBLE", "ETUDIANT", "MOBILITE", "COLOCATION", "SAISONNIER",
      "LOGEMENT_FONCTION", "ANAH", "CIVIL", "GLISSANT", "SOUS_LOCATION", "MIXTE"] as const
    habitation.forEach(t => expect(getLeaseCategory(t)).toBe("HABITATION"))
  })

  it("retourne COMMERCIAL pour les types commerciaux", () => {
    const commercial = ["COMMERCIAL_369", "DEROGATOIRE", "PRECAIRE", "BAIL_PROFESSIONNEL", "RURAL"] as const
    commercial.forEach(t => expect(getLeaseCategory(t)).toBe("COMMERCIAL"))
  })

  it("retourne FONCIER pour les baux longs", () => {
    const foncier = ["EMPHYTEOTIQUE", "CONSTRUCTION", "REHABILITATION", "BRS"] as const
    foncier.forEach(t => expect(getLeaseCategory(t)).toBe("FONCIER"))
  })

  it("retourne AUTRE pour un type inconnu (branche default)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getLeaseCategory("INCONNU" as any)).toBe("AUTRE")
  })
})

describe("getDefaultDuration", () => {
  it("retourne la durée correcte pour chaque type", () => {
    const expected: Record<string, number> = {
      HABITATION: 36, MEUBLE: 12, ETUDIANT: 9, MOBILITE: 10, COLOCATION: 12,
      SAISONNIER: 3, LOGEMENT_FONCTION: 36, ANAH: 72, CIVIL: 12, GLISSANT: 36,
      SOUS_LOCATION: 12, COMMERCIAL_369: 108, DEROGATOIRE: 36, PRECAIRE: 24,
      BAIL_PROFESSIONNEL: 72, MIXTE: 36, EMPHYTEOTIQUE: 1188, CONSTRUCTION: 840,
      REHABILITATION: 144, BRS: 1068, RURAL: 108,
    }
    Object.entries(expected).forEach(([type, dur]) => {
      expect(getDefaultDuration(type as Parameters<typeof getDefaultDuration>[0])).toBe(dur)
    })
  })

  it("retourne 36 pour un type inconnu (branche default)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getDefaultDuration("INCONNU" as any)).toBe(36)
  })
})

describe("getDefaultIndexType", () => {
  it("retourne IRL pour les baux habitation et fonciers", () => {
    const irl = ["HABITATION", "MEUBLE", "ETUDIANT", "MOBILITE", "COLOCATION", "ANAH",
      "CIVIL", "GLISSANT", "SOUS_LOCATION", "LOGEMENT_FONCTION", "MIXTE",
      "EMPHYTEOTIQUE", "CONSTRUCTION", "REHABILITATION", "BRS"] as const
    irl.forEach(t => expect(getDefaultIndexType(t)).toBe("IRL"))
  })

  it("retourne ILC pour les types commerciaux", () => {
    expect(getDefaultIndexType("COMMERCIAL_369")).toBe("ILC")
    expect(getDefaultIndexType("DEROGATOIRE")).toBe("ILC")
    expect(getDefaultIndexType("RURAL")).toBe("ILC")
  })

  it("retourne ILAT pour le bail professionnel", () => {
    expect(getDefaultIndexType("BAIL_PROFESSIONNEL")).toBe("ILAT")
  })

  it("retourne null pour les types sans index défini", () => {
    expect(getDefaultIndexType("SAISONNIER")).toBeNull()
    expect(getDefaultIndexType("PRECAIRE")).toBeNull()
  })
})

describe("getDefaultVat", () => {
  it("retourne TVA non applicable pour les baux habitation", () => {
    expect(getDefaultVat("HABITATION")).toEqual({ applicable: false, rate: 0 })
    expect(getDefaultVat("MEUBLE")).toEqual({ applicable: false, rate: 0 })
    expect(getDefaultVat("COLOCATION")).toEqual({ applicable: false, rate: 0 })
  })

  it("retourne TVA 20% pour les baux commerciaux et fonciers", () => {
    expect(getDefaultVat("COMMERCIAL_369")).toEqual({ applicable: true, rate: 20 })
    expect(getDefaultVat("EMPHYTEOTIQUE")).toEqual({ applicable: true, rate: 20 })
    expect(getDefaultVat("BAIL_PROFESSIONNEL")).toEqual({ applicable: true, rate: 20 })
  })
})

describe("getDefaultDepositMonths", () => {
  it("retourne le nombre de mois correct pour chaque type", () => {
    const expected: Record<string, number> = {
      HABITATION: 1, MEUBLE: 2, ETUDIANT: 2, MOBILITE: 0, COLOCATION: 2,
      SAISONNIER: 0, LOGEMENT_FONCTION: 1, ANAH: 1, CIVIL: 0, GLISSANT: 1,
      SOUS_LOCATION: 1, COMMERCIAL_369: 3, DEROGATOIRE: 2, PRECAIRE: 1,
      BAIL_PROFESSIONNEL: 3, MIXTE: 1, EMPHYTEOTIQUE: 0, CONSTRUCTION: 0,
      REHABILITATION: 0, BRS: 1, RURAL: 0,
    }
    Object.entries(expected).forEach(([type, months]) => {
      expect(getDefaultDepositMonths(type as Parameters<typeof getDefaultDepositMonths>[0])).toBe(months)
    })
  })

  it("retourne 1 pour un type inconnu (branche default)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getDefaultDepositMonths("INCONNU" as any)).toBe(1)
  })
})
