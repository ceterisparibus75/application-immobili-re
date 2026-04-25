import { beforeEach, describe, it, expect, vi } from "vitest"
import { prismaMock } from "@/test/mocks/prisma"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import {
  createBuilding,
  updateBuilding,
  deleteBuilding,
  getBuildings,
  getBuildingById,
  createAdditionalAcquisition,
  deleteAdditionalAcquisition,
} from "@/actions/building"
import { UserRole } from "@/generated/prisma/client"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

const validInput = {
  name: "Immeuble Central",
  addressLine1: "10 rue de la Paix",
  city: "Paris",
  postalCode: "75001",
  country: "France",
  buildingType: "BUREAU" as const,
}

const buildBuilding = (overrides = {}) => ({
  id: VALID_CUID,
  societyId: "society-1",
  name: "Immeuble Central",
  addressLine1: "10 rue de la Paix",
  addressLine2: null,
  city: "Paris",
  postalCode: "75001",
  country: "France",
  buildingType: "BUREAU",
  yearBuilt: null,
  totalArea: null,
  marketValue: null,
  netBookValue: null,
  acquisitionPrice: null,
  acquisitionFees: null,
  acquisitionTaxes: null,
  acquisitionOtherCosts: null,
  acquisitionDate: null,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe("createBuilding", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const result = await createBuilding("society-1", validInput)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Non authentifié")
  })

  it("retourne une erreur si role LECTURE (insuffisant)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const result = await createBuilding("society-1", validInput)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("retourne une erreur si nom trop court", async () => {
    mockAuthSession()
    const result = await createBuilding("society-1", { ...validInput, name: "A" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("2 caractères")
  })

  it("retourne une erreur si adresse trop courte", async () => {
    mockAuthSession()
    const result = await createBuilding("society-1", { ...validInput, addressLine1: "abc" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("adresse")
  })

  it("retourne une erreur si ville trop courte", async () => {
    mockAuthSession()
    const result = await createBuilding("society-1", { ...validInput, city: "X" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("ville")
  })

  it("retourne une erreur si code postal invalide", async () => {
    mockAuthSession()
    const result = await createBuilding("society-1", { ...validInput, postalCode: "123" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("Code postal")
  })

  it("retourne une erreur si code postal contient des lettres", async () => {
    mockAuthSession()
    const result = await createBuilding("society-1", { ...validInput, postalCode: "7500A" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("Code postal")
  })

  it("retourne une erreur si buildingType invalide", async () => {
    mockAuthSession()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createBuilding("society-1", { ...validInput, buildingType: "INVALIDE" as any })
    expect(result.success).toBe(false)
  })

  it("crée l'immeuble et retourne son id", async () => {
    mockAuthSession()
    const building = buildBuilding()
    prismaMock.building.create.mockResolvedValue(building as never)
    const result = await createBuilding("society-1", validInput)
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe(VALID_CUID)
    expect(prismaMock.building.create).toHaveBeenCalledOnce()
  })
})

describe("updateBuilding", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const result = await updateBuilding("society-1", { id: VALID_CUID, name: "Nouveau nom" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Non authentifié")
  })

  it("retourne une erreur si immeuble introuvable", async () => {
    mockAuthSession()
    prismaMock.building.findFirst.mockResolvedValue(null)
    const result = await updateBuilding("society-1", { id: VALID_CUID, name: "Nouveau nom" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Immeuble introuvable")
  })

  it("met à jour l'immeuble avec succès", async () => {
    mockAuthSession()
    const building = buildBuilding()
    prismaMock.building.findFirst.mockResolvedValue(building as never)
    prismaMock.building.update.mockResolvedValue(building as never)
    const result = await updateBuilding("society-1", { id: VALID_CUID, name: "Nouveau nom" })
    expect(result.success).toBe(true)
    expect(prismaMock.building.update).toHaveBeenCalledOnce()
  })
})

describe("deleteBuilding", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const result = await deleteBuilding("society-1", VALID_CUID)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Non authentifié")
  })

  it("retourne une erreur si role GESTIONNAIRE (insuffisant pour suppression)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const result = await deleteBuilding("society-1", VALID_CUID)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("retourne une erreur si des baux actifs existent", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.count.mockResolvedValue(2 as never)
    const result = await deleteBuilding("society-1", VALID_CUID)
    expect(result.success).toBe(false)
    expect(result.error).toContain("2 bail(aux) actif(s)")
  })

  it("supprime l'immeuble avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.count.mockResolvedValue(0 as never)
    prismaMock.building.delete.mockResolvedValue(buildBuilding() as never)
    const result = await deleteBuilding("society-1", VALID_CUID)
    expect(result.success).toBe(true)
    expect(prismaMock.building.delete).toHaveBeenCalledWith({ where: { id: VALID_CUID } })
  })

  it("retourne une erreur générique si la BDD échoue dans deleteBuilding", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.count.mockRejectedValue(new Error("DB connection lost"))
    const result = await deleteBuilding("society-1", VALID_CUID)
    expect(result).toEqual({ success: false, error: "Erreur lors de la suppression" })
  })
})

describe("getBuildings", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated()
    const result = await getBuildings("society-1")
    expect(result).toEqual([])
  })

  it("retourne la liste des immeubles", async () => {
    mockAuthSession()
    const buildings = [
      buildBuilding({ lots: [], additionalAcquisitions: [] }),
      buildBuilding({ id: "clh3x2z4k0000qh8g7z1y2v4u", name: "Immeuble B", lots: [], additionalAcquisitions: [] }),
    ]
    prismaMock.building.findMany.mockResolvedValue(buildings as never)
    const result = await getBuildings("society-1")
    expect(result).toHaveLength(2)
  })

  it("calcule additionalCost et yieldRate quand acquisitions complémentaires et coût > 0", async () => {
    mockAuthSession()
    const building = buildBuilding({
      acquisitionPrice: 100000,
      lots: [
        { status: "OCCUPE", leases: [{ currentRentHT: 1000, paymentFrequency: "MENSUEL" }] },
      ],
      additionalAcquisitions: [
        { acquisitionPrice: 10000, acquisitionFees: 500, acquisitionTaxes: 200, otherCosts: 100 },
      ],
    })
    prismaMock.building.findMany.mockResolvedValue([building] as never)
    const result = await getBuildings("society-1")
    expect(result).toHaveLength(1)
    // baseCost=100000, additionalCost=10000+500+200+100=10800 → totalCost=110800
    expect(result[0].totalCost).toBe(110800)
    expect(result[0].yieldRate).not.toBeNull()
  })
})

describe("getBuildingById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated()
    const result = await getBuildingById("society-1", VALID_CUID)
    expect(result).toBeNull()
  })

  it("retourne null si immeuble introuvable", async () => {
    mockAuthSession()
    prismaMock.building.findFirst.mockResolvedValue(null)
    const result = await getBuildingById("society-1", VALID_CUID)
    expect(result).toBeNull()
  })

  it("retourne l'immeuble avec ses relations", async () => {
    mockAuthSession()
    const building = buildBuilding({ lots: [], diagnostics: [], maintenances: [], documents: [], _count: { lots: 3, diagnostics: 1, maintenances: 2, documents: 0 } })
    prismaMock.building.findFirst.mockResolvedValue(building as never)
    const result = await getBuildingById("society-1", VALID_CUID)
    expect(result).toBeDefined()
    expect(result?.name).toBe("Immeuble Central")
    expect(prismaMock.building.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_CUID, societyId: "society-1" },
        include: expect.objectContaining({
          lots: expect.anything(),
          diagnostics: expect.anything(),
        }),
      })
    )
  })
})

const BUILDING_ID = "clh3x2z4k0001qh8g7z1y2v3t"
const ACQ_ID = "clh3x2z4k0002qh8g7z1y2v3t"

const validAcqInput = {
  label: "Extension Sud",
  acquisitionDate: "2025-06-01",
  acquisitionPrice: 50000,
}

// ─── createAdditionalAcquisition ─────────────────────────────────────────────

describe("createAdditionalAcquisition", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.GESTIONNAIRE, "society-1")
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never)
    prismaMock.additionalAcquisition.create.mockResolvedValue({ id: ACQ_ID } as never)
  })

  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await createAdditionalAcquisition("society-1", BUILDING_ID, validAcqInput)
    expect(r.success).toBe(false)
  })

  it("erreur si l'immeuble est introuvable", async () => {
    prismaMock.building.findFirst.mockResolvedValue(null as never)
    const r = await createAdditionalAcquisition("society-1", BUILDING_ID, validAcqInput)
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("crée l'acquisition avec succès", async () => {
    const r = await createAdditionalAcquisition("society-1", BUILDING_ID, validAcqInput)
    expect(r.success).toBe(true)
    expect(r.data?.id).toBe(ACQ_ID)
    expect(prismaMock.additionalAcquisition.create).toHaveBeenCalledOnce()
  })

  it("retourne une erreur si rôle insuffisant pour createAdditionalAcquisition", async () => {
    mockAuthSession(UserRole.LECTURE, "society-1")
    const r = await createAdditionalAcquisition("society-1", BUILDING_ID, validAcqInput)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/insuffisantes|refus/i)
  })

  it("retourne une erreur générique si la BDD échoue dans createAdditionalAcquisition", async () => {
    prismaMock.building.findFirst.mockRejectedValue(new Error("DB error"))
    const r = await createAdditionalAcquisition("society-1", BUILDING_ID, validAcqInput)
    expect(r).toEqual({ success: false, error: "Erreur lors de l'ajout de l'acquisition" })
  })

  it("retourne une erreur Zod si le prix d'acquisition est négatif", async () => {
    const r = await createAdditionalAcquisition("society-1", BUILDING_ID, {
      ...validAcqInput,
      acquisitionPrice: -1,
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain("positif")
  })

  it("retourne une erreur si la date d'acquisition est invalide", async () => {
    const r = await createAdditionalAcquisition("society-1", BUILDING_ID, {
      ...validAcqInput,
      acquisitionDate: "not-a-date",
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain("invalide")
  })
})

// ─── deleteAdditionalAcquisition ──────────────────────────────────────────────

describe("deleteAdditionalAcquisition", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.GESTIONNAIRE, "society-1")
    prismaMock.additionalAcquisition.findFirst.mockResolvedValue({ id: ACQ_ID, buildingId: BUILDING_ID } as never)
    prismaMock.additionalAcquisition.delete.mockResolvedValue({} as never)
  })

  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await deleteAdditionalAcquisition("society-1", ACQ_ID)
    expect(r.success).toBe(false)
  })

  it("erreur si acquisition introuvable", async () => {
    prismaMock.additionalAcquisition.findFirst.mockResolvedValue(null as never)
    const r = await deleteAdditionalAcquisition("society-1", "acq-inexistant")
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("supprime l'acquisition avec succès", async () => {
    const r = await deleteAdditionalAcquisition("society-1", ACQ_ID)
    expect(r.success).toBe(true)
    expect(prismaMock.additionalAcquisition.delete).toHaveBeenCalledWith({ where: { id: ACQ_ID } })
  })

  it("retourne une erreur si rôle insuffisant pour deleteAdditionalAcquisition", async () => {
    mockAuthSession(UserRole.LECTURE, "society-1")
    const r = await deleteAdditionalAcquisition("society-1", ACQ_ID)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/insuffisantes|refus/i)
  })

  it("retourne une erreur générique si la BDD échoue dans deleteAdditionalAcquisition", async () => {
    prismaMock.additionalAcquisition.findFirst.mockRejectedValue(new Error("DB error"))
    const r = await deleteAdditionalAcquisition("society-1", ACQ_ID)
    expect(r).toEqual({ success: false, error: "Erreur lors de la suppression" })
  })
})
