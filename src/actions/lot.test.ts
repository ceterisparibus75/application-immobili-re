import { describe, it, expect, vi } from "vitest"
import { prismaMock } from "@/test/mocks/prisma"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { createLot, updateLot, deleteLot, getLots, getLotById } from "@/actions/lot"
import { UserRole } from "@/generated/prisma/client"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const BUILDING_CUID = "clh3x2z4k0000qh8g7z1y2v4u"

const validInput = {
  buildingId: BUILDING_CUID,
  number: "A-101",
  lotType: "BUREAUX" as const,
  area: 75.5,
  status: "VACANT" as const,
}

const buildLot = (overrides = {}) => ({
  id: VALID_CUID,
  buildingId: BUILDING_CUID,
  number: "A-101",
  lotType: "BUREAUX",
  area: 75.5,
  commonShares: 0,
  floor: null,
  position: null,
  description: null,
  status: "VACANT",
  marketRentValue: null,
  currentRent: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe("createLot", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const result = await createLot("society-1", validInput)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Non authentifié")
  })

  it("retourne une erreur si role LECTURE (insuffisant)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const result = await createLot("society-1", validInput)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("retourne une erreur si validation échoue (numéro manquant)", async () => {
    mockAuthSession()
    const result = await createLot("society-1", { ...validInput, number: "" })
    expect(result.success).toBe(false)
    expect(result.error).toContain("requis")
  })

  it("retourne une erreur si validation échoue (surface négative)", async () => {
    mockAuthSession()
    const result = await createLot("society-1", { ...validInput, area: -10 })
    expect(result.success).toBe(false)
    expect(result.error).toContain("positive")
  })

  it("retourne une erreur si buildingId invalide", async () => {
    mockAuthSession()
    const result = await createLot("society-1", { ...validInput, buildingId: "not-a-cuid" })
    expect(result.success).toBe(false)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it("retourne une erreur si lotType invalide", async () => {
    mockAuthSession()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createLot("society-1", { ...validInput, lotType: "INVALIDE" as any })
    expect(result.success).toBe(false)
  })

  it("retourne une erreur si immeuble introuvable", async () => {
    mockAuthSession()
    prismaMock.building.findFirst.mockResolvedValue(null)
    const result = await createLot("society-1", validInput)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Immeuble introuvable")
  })

  it("retourne une erreur si numéro de lot dupliqué dans le même immeuble", async () => {
    mockAuthSession()
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_CUID } as never)
    prismaMock.lot.findFirst.mockResolvedValue(buildLot() as never)
    const result = await createLot("society-1", validInput)
    expect(result.success).toBe(false)
    expect(result.error).toContain("existe déjà")
  })

  it("crée le lot et retourne son id", async () => {
    mockAuthSession()
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_CUID } as never)
    prismaMock.lot.findFirst.mockResolvedValue(null)
    prismaMock.lot.create.mockResolvedValue(buildLot() as never)
    const result = await createLot("society-1", validInput)
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe(VALID_CUID)
    expect(prismaMock.lot.create).toHaveBeenCalledOnce()
  })
})

describe("updateLot", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const result = await updateLot("society-1", { id: VALID_CUID, number: "B-202" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Non authentifié")
  })

  it("retourne une erreur si lot introuvable", async () => {
    mockAuthSession()
    prismaMock.lot.findFirst.mockResolvedValue(null)
    const result = await updateLot("society-1", { id: VALID_CUID, number: "B-202" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Lot introuvable")
  })

  it("met à jour le lot avec succès", async () => {
    mockAuthSession()
    const lot = buildLot()
    prismaMock.lot.findFirst.mockResolvedValue(lot as never)
    prismaMock.lot.update.mockResolvedValue(lot as never)
    const result = await updateLot("society-1", { id: VALID_CUID, number: "B-202" })
    expect(result.success).toBe(true)
    expect(prismaMock.lot.update).toHaveBeenCalledOnce()
  })
})

describe("deleteLot", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const result = await deleteLot("society-1", VALID_CUID)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Non authentifié")
  })

  it("retourne une erreur si role GESTIONNAIRE (insuffisant pour suppression)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const result = await deleteLot("society-1", VALID_CUID)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("retourne une erreur si lot introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lot.findFirst.mockResolvedValue(null)
    const result = await deleteLot("society-1", VALID_CUID)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Lot introuvable")
  })

  it("retourne une erreur si des baux existent", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lot.findFirst.mockResolvedValue(buildLot({ _count: { leases: 3 } }) as never)
    const result = await deleteLot("society-1", VALID_CUID)
    expect(result.success).toBe(false)
    expect(result.error).toContain("3 bail(aux)")
  })

  it("supprime le lot avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lot.findFirst.mockResolvedValue(buildLot({ _count: { leases: 0 } }) as never)
    prismaMock.lot.delete.mockResolvedValue(buildLot() as never)
    const result = await deleteLot("society-1", VALID_CUID)
    expect(result.success).toBe(true)
    expect(prismaMock.lot.delete).toHaveBeenCalledWith({ where: { id: VALID_CUID } })
  })
})

describe("getLots", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated()
    const result = await getLots("society-1")
    expect(result).toEqual([])
  })

  it("retourne la liste des lots", async () => {
    mockAuthSession()
    const lots = [buildLot(), buildLot({ id: "clh3x2z4k0000qh8g7z1y2v5w", number: "A-102" })]
    prismaMock.lot.findMany.mockResolvedValue(lots as never)
    const result = await getLots("society-1")
    expect(result).toHaveLength(2)
  })
})

describe("getLotById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated()
    const result = await getLotById("society-1", VALID_CUID)
    expect(result).toBeNull()
  })

  it("retourne null si lot introuvable", async () => {
    mockAuthSession()
    prismaMock.lot.findFirst.mockResolvedValue(null)
    const result = await getLotById("society-1", VALID_CUID)
    expect(result).toBeNull()
  })

  it("retourne le lot avec ses relations", async () => {
    mockAuthSession()
    const lot = buildLot({
      building: { id: BUILDING_CUID, name: "Immeuble A", city: "Paris", postalCode: "75001" },
      leases: [],
      _count: { leases: 0 },
    })
    prismaMock.lot.findFirst.mockResolvedValue(lot as never)
    const result = await getLotById("society-1", VALID_CUID)
    expect(result).toBeDefined()
    expect(result?.number).toBe("A-101")
    expect(prismaMock.lot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_CUID, building: { societyId: "society-1" } },
        include: expect.objectContaining({
          building: expect.anything(),
          leases: expect.anything(),
        }),
      })
    )
  })
})
