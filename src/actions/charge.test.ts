import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { prismaMock } from "@/test/mocks/prisma"
import { UserRole } from "@/generated/prisma/client"
import {
  createChargeCategory,
  updateChargeCategory,
  getChargeCategories,
  createCharge,
  updateCharge,
  deleteCharge,
  getCharges,
  getChargesPaginated,
  getChargeById,
  getSocietyChargeCategories,
  createSocietyChargeCategory,
  updateSocietyChargeCategory,
  deleteSocietyChargeCategory,
  getChargeRegularizations,
  finalizeChargeReport,
  generateAnnualChargeReport,
  autoRegularizeCharges,
} from "@/actions/charge"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3u"

const validChargeCategoryInput = {
  buildingId: VALID_CUID,
  name: "Entretien parties communes",
  nature: "RECUPERABLE" as const,
  recoverableRate: 100,
  allocationMethod: "TANTIEME" as const,
}

const validChargeInput = {
  buildingId: VALID_CUID,
  categoryId: VALID_CUID_2,
  description: "Nettoyage cage escalier",
  amount: 250,
  date: "2025-01-15",
  periodStart: "2025-01-01",
  periodEnd: "2025-03-31",
  isPaid: false,
}

const validSocietyCategoryInput = {
  name: "Eau froide",
  nature: "RECUPERABLE" as const,
  allocationMethod: "TANTIEME" as const,
}

// ─── createChargeCategory ────────────────────────────────────────────────────

describe("createChargeCategory", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await createChargeCategory("society-1", validChargeCategoryInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await createChargeCategory("society-1", validChargeCategoryInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si role COMPTABLE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await createChargeCategory("society-1", validChargeCategoryInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si nom vide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createChargeCategory("society-1", {
      ...validChargeCategoryInput,
      name: "",
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain("requis")
  })

  it("erreur si nature invalide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createChargeCategory("society-1", {
      ...validChargeCategoryInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nature: "INVALIDE" as any,
    })
    expect(r.success).toBe(false)
  })

  it("erreur si buildingId invalide (pas un cuid)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createChargeCategory("society-1", {
      ...validChargeCategoryInput,
      buildingId: "not-a-cuid",
    })
    expect(r.success).toBe(false)
  })

  it("erreur si immeuble introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.building.findFirst.mockResolvedValue(null)
    const r = await createChargeCategory("society-1", validChargeCategoryInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Immeuble introuvable")
  })

  it("erreur si recoverableRate hors bornes (> 100)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createChargeCategory("society-1", {
      ...validChargeCategoryInput,
      recoverableRate: 150,
    })
    expect(r.success).toBe(false)
  })

  it("succes avec role ADMIN_SOCIETE", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.building.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: "society-1",
    } as never)
    prismaMock.chargeCategory.create.mockResolvedValue({
      id: "cat-admin",
      name: "Entretien parties communes",
    } as never)

    const r = await createChargeCategory("society-1", validChargeCategoryInput)
    expect(r.success).toBe(true)
  })

  it("succes avec audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.building.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: "society-1",
    } as never)
    prismaMock.chargeCategory.create.mockResolvedValue({
      id: "cat-1",
      name: "Entretien parties communes",
    } as never)

    const r = await createChargeCategory("society-1", validChargeCategoryInput)
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ id: "cat-1" })
    expect(prismaMock.chargeCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: "society-1",
          name: "Entretien parties communes",
          nature: "RECUPERABLE",
        }),
      })
    )

    const { createAuditLog } = await import("@/lib/audit")
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId: "society-1",
        action: "CREATE",
        entity: "ChargeCategory",
        entityId: "cat-1",
      })
    )
  })
})

// ─── createCharge ────────────────────────────────────────────────────────────

describe("createCharge", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await createCharge("society-1", validChargeInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await createCharge("society-1", validChargeInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si description vide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createCharge("society-1", {
      ...validChargeInput,
      description: "",
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain("description")
  })

  it("erreur si montant negatif", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createCharge("society-1", {
      ...validChargeInput,
      amount: -10,
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain("positif")
  })

  it("erreur si date manquante", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createCharge("society-1", {
      ...validChargeInput,
      date: "",
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain("date")
  })

  it("erreur si periodStart manquante", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createCharge("society-1", {
      ...validChargeInput,
      periodStart: "",
    })
    expect(r.success).toBe(false)
  })

  it("erreur si immeuble introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.building.findFirst.mockResolvedValue(null)
    prismaMock.chargeCategory.findFirst.mockResolvedValue({
      id: VALID_CUID_2,
    } as never)
    const r = await createCharge("society-1", validChargeInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Immeuble introuvable")
  })

  it("erreur si categorie introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.building.findFirst.mockResolvedValue({
      id: VALID_CUID,
    } as never)
    prismaMock.chargeCategory.findFirst.mockResolvedValue(null)
    const r = await createCharge("society-1", validChargeInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Catégorie introuvable")
  })

  it("erreur si periodEnd manquante", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createCharge("society-1", {
      ...validChargeInput,
      periodEnd: "",
    })
    expect(r.success).toBe(false)
  })

  it("transforme isPaid string 'true' en boolean", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.building.findFirst.mockResolvedValue({ id: VALID_CUID } as never)
    prismaMock.chargeCategory.findFirst.mockResolvedValue({ id: VALID_CUID_2 } as never)
    prismaMock.charge.create.mockResolvedValue({ id: "charge-str" } as never)

    await createCharge("society-1", {
      ...validChargeInput,
      isPaid: "true" as unknown as boolean,
    })
    expect(prismaMock.charge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true }),
      })
    )
  })

  it("succes avec creation et audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.building.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: "society-1",
    } as never)
    prismaMock.chargeCategory.findFirst.mockResolvedValue({
      id: VALID_CUID_2,
      societyId: "society-1",
    } as never)
    prismaMock.charge.create.mockResolvedValue({ id: "charge-1" } as never)

    const r = await createCharge("society-1", validChargeInput)
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ id: "charge-1" })
    expect(prismaMock.charge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: "society-1",
          amount: 250,
          description: "Nettoyage cage escalier",
        }),
      })
    )
  })
})

// ─── updateCharge ────────────────────────────────────────────────────────────

describe("updateCharge", () => {
  const updateInput = { id: VALID_CUID, description: "Mise a jour" }

  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await updateCharge("society-1", updateInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await updateCharge("society-1", updateInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si charge introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findFirst.mockResolvedValue(null)
    const r = await updateCharge("society-1", updateInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Charge introuvable")
  })

  it("succes avec mise a jour", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: "society-1",
    } as never)
    prismaMock.charge.update.mockResolvedValue({} as never)

    const r = await updateCharge("society-1", updateInput)
    expect(r.success).toBe(true)
    expect(prismaMock.charge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_CUID },
        data: expect.objectContaining({ description: "Mise a jour" }),
      })
    )
  })

  it("convertit les dates en objets Date", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: "society-1",
    } as never)
    prismaMock.charge.update.mockResolvedValue({} as never)

    const r = await updateCharge("society-1", {
      id: VALID_CUID,
      date: "2026-06-15",
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
    })
    expect(r.success).toBe(true)
    expect(prismaMock.charge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          date: expect.any(Date),
          periodStart: expect.any(Date),
          periodEnd: expect.any(Date),
        }),
      })
    )
  })
})

// ─── deleteCharge ────────────────────────────────────────────────────────────

describe("deleteCharge", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await deleteCharge("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await deleteCharge("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si charge introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findFirst.mockResolvedValue(null)
    const r = await deleteCharge("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Charge introuvable")
  })

  it("succes avec suppression et audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: "society-1",
      buildingId: VALID_CUID_2,
      amount: 300,
    } as never)
    prismaMock.charge.delete.mockResolvedValue({} as never)

    const r = await deleteCharge("society-1", VALID_CUID)
    expect(r.success).toBe(true)
    expect(prismaMock.charge.delete).toHaveBeenCalledWith({
      where: { id: VALID_CUID },
    })

    const { createAuditLog } = await import("@/lib/audit")
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE",
        entity: "Charge",
        entityId: VALID_CUID,
        details: expect.objectContaining({ buildingId: VALID_CUID_2, amount: 300 }),
      })
    )
  })
})

// ─── createSocietyChargeCategory ─────────────────────────────────────────────

describe("createSocietyChargeCategory", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await createSocietyChargeCategory("society-1", validSocietyCategoryInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await createSocietyChargeCategory("society-1", validSocietyCategoryInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si nom trop court (min 2)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createSocietyChargeCategory("society-1", {
      ...validSocietyCategoryInput,
      name: "X",
    })
    expect(r.success).toBe(false)
  })

  it("erreur si nom trop long (max 100)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createSocietyChargeCategory("society-1", {
      ...validSocietyCategoryInput,
      name: "A".repeat(101),
    })
    expect(r.success).toBe(false)
  })

  it("erreur si nature invalide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createSocietyChargeCategory("society-1", {
      ...validSocietyCategoryInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nature: "INVALIDE" as any,
    })
    expect(r.success).toBe(false)
  })

  it("succes avec creation et audit log", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.societyChargeCategory.create.mockResolvedValue({
      id: "scc-1",
      name: "Eau froide",
      societyId: "society-1",
    } as never)

    const r = await createSocietyChargeCategory("society-1", validSocietyCategoryInput)
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ id: "scc-1" })
    expect(prismaMock.societyChargeCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: "society-1",
          name: "Eau froide",
          nature: "RECUPERABLE",
        }),
      })
    )

    const { createAuditLog } = await import("@/lib/audit")
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "SocietyChargeCategory",
        entityId: "scc-1",
      })
    )
  })
})

// ─── deleteSocietyChargeCategory ─────────────────────────────────────────────

describe("deleteSocietyChargeCategory", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await deleteSocietyChargeCategory("society-1", "scc-1")
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await deleteSocietyChargeCategory("society-1", "scc-1")
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si categorie globale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.societyChargeCategory.findUnique.mockResolvedValue({
      id: "scc-1",
      isGlobal: true,
    } as never)

    const r = await deleteSocietyChargeCategory("society-1", "scc-1")
    expect(r.success).toBe(false)
    expect(r.error).toBe("Les catégories standards ne peuvent pas être supprimées")
  })

  it("succes pour categorie non-globale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.societyChargeCategory.findUnique.mockResolvedValue({
      id: "scc-1",
      isGlobal: false,
      societyId: "society-1",
    } as never)
    prismaMock.societyChargeCategory.delete.mockResolvedValue({} as never)

    const r = await deleteSocietyChargeCategory("society-1", "scc-1")
    expect(r.success).toBe(true)
    expect(prismaMock.societyChargeCategory.delete).toHaveBeenCalledWith({
      where: { id: "scc-1" },
    })
  })
})

const SOCIETY_ID = "society-1"
const VALID_CUID_3 = "clh3x2z4k0002qh8g7z1y2v3v"

// ─── updateChargeCategory ────────────────────────────────────────────────────

describe("updateChargeCategory", () => {
  const validUpdate = { id: VALID_CUID, name: "Entretien modifié" }

  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await updateChargeCategory(SOCIETY_ID, validUpdate)
    expect(r.success).toBe(false)
  })

  it("erreur si catégorie introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.chargeCategory.findFirst.mockResolvedValue(null as never)
    const r = await updateChargeCategory(SOCIETY_ID, validUpdate)
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("met à jour la catégorie avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.chargeCategory.findFirst.mockResolvedValue({ id: VALID_CUID } as never)
    prismaMock.chargeCategory.update.mockResolvedValue({} as never)
    const r = await updateChargeCategory(SOCIETY_ID, validUpdate)
    expect(r.success).toBe(true)
    expect(prismaMock.chargeCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: VALID_CUID } })
    )
  })
})

// ─── getChargeCategories ─────────────────────────────────────────────────────

describe("getChargeCategories", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getChargeCategories(SOCIETY_ID)
    expect(r).toEqual([])
  })

  it("retourne les catégories de charges", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.chargeCategory.findMany.mockResolvedValue([{ id: VALID_CUID, name: "Eau" }] as never)
    const r = await getChargeCategories(SOCIETY_ID)
    expect(r).toHaveLength(1)
  })
})

// ─── getCharges ───────────────────────────────────────────────────────────────

describe("getCharges", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getCharges(SOCIETY_ID)
    expect(r).toEqual([])
  })

  it("retourne les charges", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findMany.mockResolvedValue([{ id: VALID_CUID_2, amount: 150 }] as never)
    const r = await getCharges(SOCIETY_ID)
    expect(r).toHaveLength(1)
  })
})

// ─── getChargeById ────────────────────────────────────────────────────────────

describe("getChargeById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getChargeById(SOCIETY_ID, VALID_CUID_2)
    expect(r).toBeNull()
  })

  it("retourne la charge si trouvée", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findFirst.mockResolvedValue({ id: VALID_CUID_2, amount: 150 } as never)
    const r = await getChargeById(SOCIETY_ID, VALID_CUID_2)
    expect(r?.id).toBe(VALID_CUID_2)
  })
})

// ─── getSocietyChargeCategories ───────────────────────────────────────────────

describe("getSocietyChargeCategories", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getSocietyChargeCategories(SOCIETY_ID)
    expect(r).toEqual([])
  })

  it("retourne les catégories incluant les globales", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.societyChargeCategory.findMany.mockResolvedValue([
      { id: "scc-1", name: "Eau froide", isGlobal: true },
      { id: "scc-2", name: "Gardiennage", isGlobal: false },
    ] as never)
    const r = await getSocietyChargeCategories(SOCIETY_ID)
    expect(r).toHaveLength(2)
  })
})

// ─── updateSocietyChargeCategory ─────────────────────────────────────────────

describe("updateSocietyChargeCategory", () => {
  const validUpdate = { id: VALID_CUID_3, name: "Eau modifiée" }

  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await updateSocietyChargeCategory(SOCIETY_ID, validUpdate)
    expect(r.success).toBe(false)
  })

  it("bloque la modification d'une catégorie globale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.societyChargeCategory.findUnique.mockResolvedValue({ id: VALID_CUID_3, isGlobal: true } as never)
    const r = await updateSocietyChargeCategory(SOCIETY_ID, validUpdate)
    expect(r.success).toBe(false)
    expect(r.error).toContain("standards")
  })

  it("met à jour avec succès une catégorie non globale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.societyChargeCategory.findUnique.mockResolvedValue({ id: VALID_CUID_3, isGlobal: false } as never)
    prismaMock.societyChargeCategory.update.mockResolvedValue({} as never)
    const r = await updateSocietyChargeCategory(SOCIETY_ID, validUpdate)
    expect(r.success).toBe(true)
  })
})

// ─── getChargeRegularizations ─────────────────────────────────────────────────

describe("getChargeRegularizations", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getChargeRegularizations(SOCIETY_ID)
    expect(r).toEqual([])
  })

  it("retourne les régularisations", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.chargeRegularization.findMany.mockResolvedValue([
      { id: "reg-1", fiscalYear: 2024 },
    ] as never)
    const r = await getChargeRegularizations(SOCIETY_ID)
    expect(r).toHaveLength(1)
  })
})

// ─── finalizeChargeReport ─────────────────────────────────────────────────────

describe("finalizeChargeReport", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await finalizeChargeReport(SOCIETY_ID, "reg-1")
    expect(r.success).toBe(false)
  })

  it("finalise le rapport avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.chargeRegularization.update.mockResolvedValue({} as never)
    const r = await finalizeChargeReport(SOCIETY_ID, "reg-1")
    expect(r.success).toBe(true)
    expect(prismaMock.chargeRegularization.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isFinalized: true }) })
    )
  })
})

// ─── getChargesPaginated ──────────────────────────────────────────────────────

describe("getChargesPaginated", () => {
  it("retourne { data: [], total: 0 } si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getChargesPaginated(SOCIETY_ID)
    expect(r.data).toEqual([])
    expect(r.total).toBe(0)
  })

  it("retourne les charges paginées", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findMany.mockResolvedValue([{ id: VALID_CUID }] as never)
    prismaMock.charge.count.mockResolvedValue(1 as never)

    const r = await getChargesPaginated(SOCIETY_ID, { page: 1, pageSize: 10 })
    expect(r.data).toHaveLength(1)
    expect(r.total).toBe(1)
  })

  it("applique le filtre de recherche", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findMany.mockResolvedValue([] as never)
    prismaMock.charge.count.mockResolvedValue(0 as never)

    await getChargesPaginated(SOCIETY_ID, { search: "plomberie" })

    expect(prismaMock.charge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    )
  })
})

// ─── generateAnnualChargeReport ───────────────────────────────────────────────

const BUILDING_ID = "clh3x2z4k0002qh8g7z1y2v3v"
const LEASE_ID = "clh3x2z4k0003qh8g7z1y2v3w"

function makeCharge() {
  return {
    id: VALID_CUID,
    societyId: SOCIETY_ID,
    buildingId: BUILDING_ID,
    categoryId: "cat-1",
    amount: 1200,
    date: new Date("2024-06-01"),
    category: {
      id: "cat-1",
      name: "Entretien",
      nature: "RECUPERABLE",
      recoverableRate: 100,
      allocationMethod: "TANTIEME",
    },
  }
}

function makeLot() {
  return {
    id: VALID_CUID_2,
    area: 50,
    commonShares: 100,
    number: "A101",
  }
}

function makeLease() {
  return {
    id: LEASE_ID,
    startDate: new Date("2024-01-01"),
    endDate: null,
    lot: { ...makeLot(), building: { id: BUILDING_ID } },
    tenant: { firstName: "Jean", lastName: "Dupont", companyName: null, entityType: "PERSONNE_PHYSIQUE" },
    chargeProvisions: [],
  }
}

describe("generateAnnualChargeReport", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await generateAnnualChargeReport(SOCIETY_ID, BUILDING_ID, 2024)
    expect(r.success).toBe(false)
  })

  it("retourne une erreur si aucune charge trouvée", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findMany.mockResolvedValue([] as never)

    const r = await generateAnnualChargeReport(SOCIETY_ID, BUILDING_ID, 2024)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/Aucune charge/)
  })

  it("retourne une erreur si aucun bail actif", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findMany.mockResolvedValue([makeCharge()] as never)
    prismaMock.lot.findMany.mockResolvedValue([makeLot()] as never)
    prismaMock.lease.findMany.mockResolvedValue([] as never)

    const r = await generateAnnualChargeReport(SOCIETY_ID, BUILDING_ID, 2024)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/Aucun bail/)
  })

  it("génère les régularisations annuelles avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.charge.findMany.mockResolvedValue([makeCharge()] as never)
    prismaMock.lot.findMany.mockResolvedValue([makeLot()] as never)
    prismaMock.lease.findMany.mockResolvedValue([makeLease()] as never)
    prismaMock.chargeRegularization.upsert.mockResolvedValue({} as never)

    const r = await generateAnnualChargeReport(SOCIETY_ID, BUILDING_ID, 2024)
    expect(r.success).toBe(true)
    expect(r.data?.created).toBe(1)
    expect(prismaMock.chargeRegularization.upsert).toHaveBeenCalledTimes(1)
  })
})

// ─── autoRegularizeCharges ────────────────────────────────────────────────────

describe("autoRegularizeCharges", () => {
  const validInput = {
    buildingId: BUILDING_ID,
    fiscalYear: 2024,
    periodStart: "2024-01-01",
    periodEnd: "2024-12-31",
  }

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await autoRegularizeCharges(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
  })

  it("régularise les charges avec succès", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.charge.findMany.mockResolvedValue([makeCharge()] as never)
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...makeLease(),
        chargeProvisions: [{ monthlyAmount: 100, startDate: new Date("2024-01-01"), endDate: null }],
      },
    ] as never)
    prismaMock.chargeRegularization.upsert.mockResolvedValue({} as never)

    const r = await autoRegularizeCharges(SOCIETY_ID, validInput)
    expect(r.success).toBe(true)
    expect(r.data?.regularizations).toBe(1)
    expect(prismaMock.chargeRegularization.upsert).toHaveBeenCalledTimes(1)
  })
})
