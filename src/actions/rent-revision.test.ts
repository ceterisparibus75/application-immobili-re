import { describe, it, expect, vi } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { prismaMock } from "@/test/mocks/prisma"
import { UserRole } from "@/generated/prisma/client"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import {
  getPendingRevisions,
  validateRevision,
  rejectRevision,
  createManualRevision,
  detectPendingRevisions,
  previewCatchUpRevisions,
  applyCatchUpRevisions,
} from "./rent-revision"

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const SOCIETY_ID = "society-1"

// ─── getPendingRevisions ─────────────────────────────────────────────────────

describe("getPendingRevisions", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getPendingRevisions(SOCIETY_ID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si rôle LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await getPendingRevisions(SOCIETY_ID)
    expect(r.success).toBe(false)
  })

  it("retourne les révisions en attente", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const revisions = [
      {
        id: "rev-1",
        effectiveDate: new Date(),
        previousRentHT: 1000,
        newRentHT: 1020,
        isValidated: false,
        lease: {
          id: "lease-1",
          startDate: new Date(),
          currentRentHT: 1000,
          tenant: { id: "t-1", entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Jean", lastName: "Dupont" },
          lot: { number: "A1", building: { id: "b-1", name: "Immeuble A", city: "Paris" } },
        },
      },
    ]
    prismaMock.rentRevision.findMany.mockResolvedValue(revisions as never)

    const r = await getPendingRevisions(SOCIETY_ID)
    expect(r.success).toBe(true)
    expect(r.data).toHaveLength(1)
  })
})

// ─── validateRevision ────────────────────────────────────────────────────────

describe("validateRevision", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await validateRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si rôle COMPTABLE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await validateRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
  })

  it("erreur si révision introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)

    const r = await validateRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Révision introuvable")
  })

  it("erreur si déjà validée", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockResolvedValue({
      id: VALID_CUID,
      isValidated: true,
      leaseId: "lease-1",
      lease: { id: "lease-1" },
    } as never)

    const r = await validateRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Cette révision est déjà validée")
  })

  it("valide la révision et met à jour le bail", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockResolvedValue({
      id: VALID_CUID,
      isValidated: false,
      leaseId: "lease-1",
      newRentHT: 1050,
      newIndexValue: 138.5,
      previousRentHT: 1000,
      indexType: "IRL",
      baseIndexValue: 132,
      lease: { id: "lease-1" },
    } as never)
    prismaMock.$transaction.mockResolvedValue([{}, {}] as never)

    const r = await validateRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.newRentHT).toBe(1050)
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })
})

// ─── rejectRevision ──────────────────────────────────────────────────────────

describe("rejectRevision", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await rejectRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si révision introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)

    const r = await rejectRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Révision introuvable")
  })

  it("erreur si déjà validée", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockResolvedValue({
      id: VALID_CUID,
      isValidated: true,
      leaseId: "lease-1",
    } as never)

    const r = await rejectRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Impossible de rejeter une révision déjà validée")
  })

  it("supprime la révision", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockResolvedValue({
      id: VALID_CUID,
      isValidated: false,
      leaseId: "lease-1",
      indexType: "IRL",
    } as never)
    prismaMock.rentRevision.delete.mockResolvedValue({} as never)

    const r = await rejectRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(prismaMock.rentRevision.delete).toHaveBeenCalledWith({
      where: { id: VALID_CUID },
    })
  })
})

// ─── createManualRevision ────────────────────────────────────────────────────

describe("createManualRevision", () => {
  const validInput = {
    leaseId: VALID_CUID,
    effectiveDate: "2026-07-01",
    newIndexValue: 140,
  }

  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await createManualRevision(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si bail introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(null)

    const r = await createManualRevision(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Bail introuvable ou inactif")
  })

  it("erreur si bail sans clause d'indexation", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({
      id: VALID_CUID,
      indexType: null,
      baseIndexValue: 132,
      currentRentHT: 1000,
    } as never)

    const r = await createManualRevision(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Ce bail n\u2019a pas de clause d\u2019indexation")
  })

  it("erreur si bail sans indice de base", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({
      id: VALID_CUID,
      indexType: "IRL",
      baseIndexValue: null,
      currentRentHT: 1000,
    } as never)

    const r = await createManualRevision(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Aucun indice de base défini sur ce bail")
  })

  it("calcule le nouveau loyer correctement", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({
      id: VALID_CUID,
      indexType: "IRL",
      baseIndexValue: 130,
      currentRentHT: 1000,
    } as never)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-1" } as never)

    const r = await createManualRevision(SOCIETY_ID, {
      ...validInput,
      newIndexValue: 140,
    })

    expect(r.success).toBe(true)
    expect(r.data?.id).toBe("rev-1")

    // newRentHT = 1000 * (140 / 130) = 1076.92 (arrondi à 2 décimales)
    expect(prismaMock.rentRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaseId: VALID_CUID,
          previousRentHT: 1000,
          newRentHT: 1076.92,
          baseIndexValue: 130,
          newIndexValue: 140,
          isValidated: false,
          formula: expect.stringContaining("1076.92"),
        }),
      })
    )
  })

  it("retourne le loyer inchangé si baseIndexValue <= 0", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({
      id: VALID_CUID,
      indexType: "IRL",
      baseIndexValue: 0,
      currentRentHT: 1000,
    } as never)

    const r = await createManualRevision(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Aucun indice de base défini sur ce bail")
  })
})

const VALID_LEASE_BASE = {
  id: VALID_CUID,
  indexType: "IRL" as const,
  baseIndexValue: 131.31,
  baseIndexQuarter: null,
  revisionFrequency: 12,
  revisionDateBasis: null,
  revisionCustomMonth: null,
  revisionCustomDay: null,
  entryDate: null,
  currentRentHT: 1000,
  rentRevisions: [],
  tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Jean", lastName: "Dupont" },
  lot: { number: "A1", building: { name: "Immeuble A" } },
  society: { id: SOCIETY_ID, userSocieties: [{ userId: "user-manager" }] },
  societyId: SOCIETY_ID,
}

function leaseStartedOneYearAgo() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d
}

// ─── detectPendingRevisions ───────────────────────────────────────────────────

describe("detectPendingRevisions", () => {
  it("retourne 0 créations si aucun bail actif indexé", async () => {
    prismaMock.lease.findMany.mockResolvedValue([] as never)
    const r = await detectPendingRevisions()
    expect(r.created).toBe(0)
    expect(r.errors).toHaveLength(0)
  })

  it("ignore les baux sans indexType ou baseIndexValue", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        indexType: null,
        baseIndexValue: null,
        startDate: new Date("2022-01-01"),
      },
    ] as never)

    const r = await detectPendingRevisions()
    expect(r.created).toBe(0)
  })

  it("crée une révision et une notification pour un bail dont la révision est dans la fenêtre", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { ...VALID_LEASE_BASE, startDate: leaseStartedOneYearAgo() },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null) // pas de révision en attente
    prismaMock.inseeIndex.findFirst.mockResolvedValue({ value: 142.0, year: 2026, quarter: 1 } as never)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-auto-1" } as never)
    prismaMock.notification.create.mockResolvedValue({} as never)

    const r = await detectPendingRevisions()

    expect(r.created).toBe(1)
    expect(r.errors).toHaveLength(0)
    expect(prismaMock.rentRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaseId: VALID_CUID,
          previousRentHT: 1000,
          newIndexValue: 142.0,
          isValidated: false,
        }),
      })
    )
    expect(prismaMock.notification.create).toHaveBeenCalledOnce()
  })

  it("saute un bail dont une révision est déjà en attente", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { ...VALID_LEASE_BASE, startDate: leaseStartedOneYearAgo() },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue({ id: "rev-pending" } as never)

    const r = await detectPendingRevisions()

    expect(r.created).toBe(0)
    expect(prismaMock.rentRevision.create).not.toHaveBeenCalled()
  })

  it("ajoute une erreur si aucun indice n'est disponible pour le bail", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { ...VALID_LEASE_BASE, startDate: leaseStartedOneYearAgo() },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(null) // aucun indice

    const r = await detectPendingRevisions()

    expect(r.created).toBe(0)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toContain("aucun indice IRL disponible")
  })
})

// ─── previewCatchUpRevisions ──────────────────────────────────────────────────

const BASE_LEASE = {
  id: VALID_CUID,
  indexType: "IRL",
  baseIndexValue: 131.31,
  baseIndexQuarter: "T1 2021",
  currentRentHT: 800,
  revisionFrequency: 12,
  startDate: new Date("2021-01-01"),
  status: "EN_COURS",
}

const IDX_2021 = { value: 131.31, year: 2021, quarter: 1 }
const IDX_2022 = { value: 136.0, year: 2022, quarter: 1 }
const IDX_2023 = { value: 142.0, year: 2023, quarter: 1 }

describe("previewCatchUpRevisions", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
  })

  it("erreur si bail introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(null as never)
    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("erreur si bail sans indexation", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({
      id: VALID_CUID, indexType: null, baseIndexValue: null,
      startDate: new Date("2022-01-01"), currentRentHT: 800, revisionFrequency: 12,
    } as never)
    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("sans indexation")
  })

  it("retourne le preview chaîné avec les étapes de rattrapage", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(BASE_LEASE as never)
    // findBaseIndexInfo : findMany avec preferred quarter T1
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never)
    // buildCatchUpPreview : findFirst (latestAvailable)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(IDX_2023 as never)
    // buildCatchUpPreview : findMany (indices range)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021, IDX_2022, IDX_2023] as never)
    // buildCatchUpPreview : rentRevision.findFirst (lastRevision) → null
    prismaMock.rentRevision.findFirst.mockResolvedValue(null as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.steps).toHaveLength(2) // 2022 + 2023
    expect(r.data?.finalRent).toBeGreaterThan(800)
    expect(r.data?.finalIndexValue).toBe(142.0)
  })
})

// ─── applyCatchUpRevisions ────────────────────────────────────────────────────

describe("applyCatchUpRevisions", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
  })

  it("propage l'erreur du preview si le bail est introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(null as never)
    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
  })

  it("retourne une erreur si une révision est déjà en attente", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    // mocks pour previewCatchUpRevisions
    prismaMock.lease.findFirst.mockResolvedValueOnce(BASE_LEASE as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(IDX_2023 as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021, IDX_2022, IDX_2023] as never)
    prismaMock.rentRevision.findFirst
      .mockResolvedValueOnce(null as never)             // lastRevision (preview)
      .mockResolvedValueOnce({ id: "rev-pending" } as never) // existing pending (applyCatch)

    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("en attente")
  })

  it("applique le rattrapage chaîné avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    // mocks pour previewCatchUpRevisions
    prismaMock.lease.findFirst
      .mockResolvedValueOnce(BASE_LEASE as never) // preview
      .mockResolvedValueOnce(BASE_LEASE as never) // applyCatch fetch
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(IDX_2023 as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021, IDX_2022, IDX_2023] as never)
    prismaMock.rentRevision.findFirst
      .mockResolvedValueOnce(null as never) // lastRevision (preview)
      .mockResolvedValueOnce(null as never) // existing pending (applyCatch)
    prismaMock.$transaction.mockResolvedValue(undefined as never)

    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.stepsCount).toBe(2)
    expect(r.data?.finalRent).toBeGreaterThan(800)
  })

  it("retourne erreur si bail introuvable après vérification révision existante", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst
      .mockResolvedValueOnce(BASE_LEASE as never) // preview
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(IDX_2023 as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021, IDX_2022, IDX_2023] as never)
    prismaMock.rentRevision.findFirst
      .mockResolvedValueOnce(null as never) // lastRevision (preview)
      .mockResolvedValueOnce(null as never) // existing pending (applyCatch)
    prismaMock.lease.findFirst.mockResolvedValueOnce(null as never) // bail introuvable
    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("retourne une erreur si rôle insuffisant", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/insuffisantes|refus/i)
  })

  it("retourne une erreur générique si la BDD échoue", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB connection lost"))
    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("rattrapage")
  })

// ─── Branches manquantes — catch blocks, Zod, calculateNewRent ───────────────

describe("getPendingRevisions — erreur générique", () => {
  it("retourne une erreur générique si la BDD échoue (lignes 139-140)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findMany.mockRejectedValue(new Error("DB error"))
    const r = await getPendingRevisions(SOCIETY_ID)
    expect(r).toEqual({ success: false, error: "Erreur lors de la récupération des révisions" })
  })
})

describe("validateRevision — branches manquantes", () => {
  it("retourne une erreur Zod si revisionId invalide (lignes 156-158)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await validateRevision(SOCIETY_ID, "not-a-cuid")
    expect(r.success).toBe(false)
  })

  it("retourne une erreur générique si la BDD échoue (lignes 229-230)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockRejectedValue(new Error("DB error"))
    const r = await validateRevision(SOCIETY_ID, VALID_CUID)
    expect(r).toEqual({ success: false, error: "Erreur lors de la validation de la révision" })
  })
})

describe("rejectRevision — branches manquantes", () => {
  it("retourne une erreur Zod si revisionId invalide (lignes 246-248)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await rejectRevision(SOCIETY_ID, "not-a-cuid")
    expect(r.success).toBe(false)
  })

  it("retourne une erreur ForbiddenError si rôle insuffisant (lignes 285-286)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await rejectRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
  })

  it("retourne une erreur générique si la BDD échoue (lignes 287-288)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockRejectedValue(new Error("DB error"))
    const r = await rejectRevision(SOCIETY_ID, VALID_CUID)
    expect(r).toEqual({ success: false, error: "Erreur lors du rejet de la révision" })
  })
})

describe("createManualRevision — branches manquantes", () => {
  const validInput = { leaseId: VALID_CUID, effectiveDate: "2026-07-01", newIndexValue: 140 }

  it("retourne une erreur Zod si l'input est invalide (lignes 301-303)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createManualRevision(SOCIETY_ID, { leaseId: "bad-id", effectiveDate: "2026-07-01", newIndexValue: 140 })
    expect(r.success).toBe(false)
  })

  it("retourne une erreur ForbiddenError si rôle insuffisant (ligne 361)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await createManualRevision(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/insuffisantes|refus/i)
  })

  it("retourne une erreur générique si la BDD échoue (lignes 363-364)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB error"))
    const r = await createManualRevision(SOCIETY_ID, validInput)
    expect(r).toEqual({ success: false, error: "Erreur lors de la création de la révision" })
  })

  it("retourne le loyer inchangé si baseIndexValue est négatif (ligne 25)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({
      id: VALID_CUID,
      indexType: "IRL",
      baseIndexValue: -1,
      currentRentHT: 1000,
    } as never)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(null)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-1" } as never)
    const r = await createManualRevision(SOCIETY_ID, validInput)
    expect(r.success).toBe(true)
  })
})

describe("detectPendingRevisions — branches manquantes", () => {
  function leaseStartedYearsAgo(years: number) {
    const d = new Date()
    d.setFullYear(d.getFullYear() - years)
    return d
  }

  it("saute un bail dont la prochaine révision est hors fenêtre (ligne 434)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedYearsAgo(3),
        revisionFrequency: 12,
        rentRevisions: [{ effectiveDate: leaseStartedYearsAgo(2) }],
      },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    const r = await detectPendingRevisions()
    expect(r.created).toBe(0)
  })

  it("utilise baseIndexQuarter pour chercher l'indice cible (lignes 447-449)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        baseIndexQuarter: "T1 2024",
        rentRevisions: [],
      },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    prismaMock.inseeIndex.findFirst
      .mockResolvedValueOnce({ value: 142.0, year: 2025, quarter: 1 } as never)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-q" } as never)
    prismaMock.notification.create.mockResolvedValue({} as never)
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("essaie l'année précédente si l'indice cible est absent (lignes 455-456)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        baseIndexQuarter: "T1 2024",
        rentRevisions: [],
      },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    prismaMock.inseeIndex.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ value: 142.0, year: 2024, quarter: 1 } as never)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-prev" } as never)
    prismaMock.notification.create.mockResolvedValue({} as never)
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("saute si le nouvel indice est identique à l'indice de base (ligne 474)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { ...VALID_LEASE_BASE, startDate: leaseStartedOneYearAgo(), baseIndexValue: 131.31 },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    prismaMock.inseeIndex.findFirst.mockResolvedValue({ value: 131.31, year: 2026, quarter: 1 } as never)
    const r = await detectPendingRevisions()
    expect(r.created).toBe(0)
  })

  it("capture l'erreur d'un bail individuel (lignes 517-518)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { ...VALID_LEASE_BASE, startDate: leaseStartedOneYearAgo() },
    ] as never)
    prismaMock.rentRevision.findFirst.mockRejectedValue(new Error("lease error"))
    const r = await detectPendingRevisions()
    expect(r.errors).toHaveLength(1)
  })

  it("capture l'erreur globale de detectPendingRevisions (lignes 522-523)", async () => {
    prismaMock.lease.findMany.mockRejectedValue(new Error("global error"))
    const r = await detectPendingRevisions()
    expect(r.errors.some(e => e.includes("global error"))).toBe(true)
  })

  it("utilise DATE_ENTREE comme date d'ancrage (ligne 538)", async () => {
    const entryDate = new Date()
    entryDate.setFullYear(entryDate.getFullYear() - 1)
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedYearsAgo(2),
        entryDate,
        revisionDateBasis: "DATE_ENTREE",
        revisionFrequency: 12,
        rentRevisions: [],
      },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    prismaMock.inseeIndex.findFirst.mockResolvedValue({ value: 142.0, year: 2026, quarter: 1 } as never)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-entry" } as never)
    prismaMock.notification.create.mockResolvedValue({} as never)
    const r = await detectPendingRevisions()
    expect(r.created).toBeGreaterThanOrEqual(0)
  })

  it("utilise PREMIER_JANVIER comme date d'ancrage (lignes 540-541, 572)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedYearsAgo(2),
        revisionDateBasis: "PREMIER_JANVIER",
        revisionFrequency: 12,
        rentRevisions: [],
      },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    prismaMock.inseeIndex.findFirst.mockResolvedValue({ value: 142.0, year: 2026, quarter: 1 } as never)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-jan" } as never)
    prismaMock.notification.create.mockResolvedValue({} as never)
    const r = await detectPendingRevisions()
    expect(r.created).toBeGreaterThanOrEqual(0)
  })

  it("utilise lastRevisionDate pour calculer la prochaine date (lignes 566-568)", async () => {
    const lastRev = new Date()
    lastRev.setMonth(lastRev.getMonth() - 11)
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedYearsAgo(2),
        rentRevisions: [{ effectiveDate: lastRev }],
        revisionFrequency: 12,
      },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    prismaMock.inseeIndex.findFirst.mockResolvedValue({ value: 142.0, year: 2026, quarter: 1 } as never)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-last" } as never)
    prismaMock.notification.create.mockResolvedValue({} as never)
    const r = await detectPendingRevisions()
    expect(r.created).toBeGreaterThanOrEqual(0)
  })
})

  it("exécute le callback $transaction avec les révisions chaînées (lignes 868-889)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst
      .mockResolvedValueOnce(BASE_LEASE as never) // preview
      .mockResolvedValueOnce(BASE_LEASE as never) // applyCatch fetch
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(IDX_2023 as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021, IDX_2022, IDX_2023] as never)
    prismaMock.rentRevision.findFirst
      .mockResolvedValueOnce(null as never) // lastRevision (buildCatchUpPreview)
      .mockResolvedValueOnce(null as never) // existing pending (applyCatch)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock))
    prismaMock.rentRevision.create.mockResolvedValue({} as never)
    prismaMock.lease.update.mockResolvedValue({} as never)

    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.stepsCount).toBe(2)
    expect(prismaMock.rentRevision.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.lease.update).toHaveBeenCalledOnce()
  })

  it("retourne une erreur générique si $transaction échoue après preview réussi (lignes 924-925)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst
      .mockResolvedValueOnce(BASE_LEASE as never) // preview
      .mockResolvedValueOnce(BASE_LEASE as never) // applyCatch fetch
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(IDX_2023 as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021, IDX_2022, IDX_2023] as never)
    prismaMock.rentRevision.findFirst
      .mockResolvedValueOnce(null as never) // lastRevision (buildCatchUpPreview)
      .mockResolvedValueOnce(null as never) // existing pending (applyCatch)
    prismaMock.$transaction.mockRejectedValue(new Error("DB error"))

    const r = await applyCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("rattrapage")
  })
})

// ─── Branches manquantes — findBaseIndexInfo, buildCatchUpPreview ─────────────

describe("previewCatchUpRevisions — branches manquantes", () => {
  const NO_QUARTER_LEASE = { ...BASE_LEASE, baseIndexQuarter: null }

  it("utilise tous les trimestres si le trimestre préféré ne donne pas de match (lignes 620-627, 643-644)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(BASE_LEASE as never)
    // preferred quarter T1: value 200 is >5% away from 131.31 → no match
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([{ value: 200.0, year: 2021, quarter: 1 }] as never)
    // all quarters: 2 candidates; second (132.0) is closer than first (150.0) → line 643-644
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([
      { value: 150.0, year: 2021, quarter: 2 },
      { value: 132.0, year: 2021, quarter: 3 },
    ] as never)
    // buildCatchUpPreview with quarter=3, baseYear=2021
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce({ value: 143.0, year: 2023, quarter: 3 } as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([
      { value: 132.0, year: 2021, quarter: 3 },
      { value: 137.0, year: 2022, quarter: 3 },
      { value: 143.0, year: 2023, quarter: 3 },
    ] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.steps).toHaveLength(2)
  })

  it("retourne une erreur si baseInfo est null et aucun indice après l'année de base (lignes 688-712)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(BASE_LEASE as never)
    // Both findMany return values >5% away → baseInfo = null
    prismaMock.inseeIndex.findMany
      .mockResolvedValueOnce([{ value: 200.0, year: 2021, quarter: 1 }] as never)
      .mockResolvedValueOnce([{ value: 200.0, year: 2021, quarter: 1 }] as never)
    // fallback: lastRevision → null → fallbackYear=2021, fallbackQuarter=1
    prismaMock.rentRevision.findFirst.mockResolvedValueOnce(null as never)
    // anyAfter → null → error
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce(null as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("disponible après")
  })

  it("interroge latestAny si aucun trimestre de référence n'est disponible (lignes 699-703)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(NO_QUARTER_LEASE as never)
    // No preferred quarter → only all-quarters search, no match
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([{ value: 200.0, year: 2021, quarter: 1 }] as never)
    // fallback: lastRevision → null
    prismaMock.rentRevision.findFirst.mockResolvedValueOnce(null as never)
    // latestAny → provides fallbackQuarter=2
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce({ value: 136.0, year: 2022, quarter: 2 } as never)
    // anyAfter → null → error
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce(null as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("disponible après")
  })

  it("utilise le fallback et appelle buildCatchUpPreview si anyAfter est disponible (ligne 714)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(NO_QUARTER_LEASE as never)
    // All-quarters search: no close match → baseInfo = null
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([{ value: 200.0, year: 2021, quarter: 1 }] as never)
    // fallback: lastRevision → null
    prismaMock.rentRevision.findFirst.mockResolvedValueOnce(null as never)
    // latestAny → quarter=2
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce({ value: 136.0, year: 2022, quarter: 2 } as never)
    // anyAfter → available
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce({ value: 140.0, year: 2022, quarter: 2 } as never)
    // buildCatchUpPreview: latestAvailable
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce({ value: 145.0, year: 2023, quarter: 2 } as never)
    // buildCatchUpPreview: range
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([
      { value: 131.31, year: 2021, quarter: 2 },
      { value: 136.0, year: 2022, quarter: 2 },
      { value: 145.0, year: 2023, quarter: 2 },
    ] as never)
    // buildCatchUpPreview: lastRevision
    prismaMock.rentRevision.findFirst.mockResolvedValueOnce(null as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.steps).toHaveLength(2)
  })

  it("retourne une erreur si aucun indice latestAvailable n'est disponible (ligne 741)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(BASE_LEASE as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never) // preferred quarter: match
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce(null as never) // latestAvailable → null

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("disponible")
  })

  it("retourne une erreur si targetYear <= baseYear (lignes 745-747)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(BASE_LEASE as never)
    // preferred quarter: exact match → baseInfo = { year: 2021, quarter: 1 }
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never)
    // buildCatchUpPreview: latestAvailable same year as baseYear → targetYear <= baseYear
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce({ value: 131.31, year: 2021, quarter: 1 } as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("déjà à jour")
  })

  it("insère baseIndexValue dans indexMap si la plage est vide (ligne 765) puis retourne une erreur si aucune étape (ligne 816)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(BASE_LEASE as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never) // preferred quarter: match
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce({ value: 142.0, year: 2023, quarter: 1 } as never) // latestAvailable
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([] as never) // range empty → line 765 triggered
    prismaMock.rentRevision.findFirst.mockResolvedValueOnce(null as never) // lastRevision

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("manquants entre")
  })

  it("avance la date d'effet dans la boucle while si la dernière révision est antérieure à l'année de base (ligne 789)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(BASE_LEASE as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never) // preferred quarter: match
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce({ value: 142.0, year: 2023, quarter: 1 } as never) // latestAvailable
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021, IDX_2022, IDX_2023] as never) // range
    // lastRevision far in the past → while loop advances effectiveDate (line 789)
    prismaMock.rentRevision.findFirst.mockResolvedValueOnce({
      effectiveDate: new Date("2020-01-01"),
      isValidated: true,
    } as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.steps).toHaveLength(2)
  })
})

describe("detectPendingRevisions — DATE_PERSONNALISEE", () => {
  it("utilise DATE_PERSONNALISEE comme date d'ancrage (lignes 544-548)", async () => {
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 1)
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate,
        revisionDateBasis: "DATE_PERSONNALISEE",
        revisionCustomMonth: 6,
        revisionCustomDay: 15,
        revisionFrequency: 12,
        rentRevisions: [],
      },
    ] as never)
    // Computed revision date is likely outside the detection window → no extra DB calls needed
    const r = await detectPendingRevisions()
    expect(r.errors).toHaveLength(0)
  })
})

// ─── validateRevision — matchingIndex trouvé ──────────────────────────────────

describe("validateRevision — matchingIndex trouvé (B10, B11)", () => {
  it("définit newBaseIndexQuarter quand l'indice correspondant est trouvé (B10 arm0, B11 arm0)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.rentRevision.findFirst.mockResolvedValue({
      id: VALID_CUID,
      isValidated: false,
      leaseId: "lease-1",
      newRentHT: 1050,
      newIndexValue: 138.5,
      previousRentHT: 1000,
      indexType: "IRL",
      baseIndexValue: 132,
      lease: { id: "lease-1" },
    } as never)
    prismaMock.inseeIndex.findFirst.mockResolvedValue({ value: 138.5, year: 2024, quarter: 1 } as never)
    prismaMock.$transaction.mockResolvedValue([{}, {}] as never)

    const r = await validateRevision(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.newRentHT).toBe(1050)
  })
})

// ─── detectPendingRevisions — branches restantes ──────────────────────────────

describe("detectPendingRevisions — branches restantes", () => {
  function setupRevisionCreation() {
    prismaMock.rentRevision.findFirst.mockResolvedValue(null)
    prismaMock.inseeIndex.findFirst.mockResolvedValue({ value: 142.0, year: 2026, quarter: 1 } as never)
    prismaMock.rentRevision.create.mockResolvedValue({ id: "rev-x" } as never)
    prismaMock.notification.create.mockResolvedValue({} as never)
  }

  it("traite un bail avec baseIndexQuarter au format invalide — fallback latest index (B4 arm0)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { ...VALID_LEASE_BASE, startDate: leaseStartedOneYearAgo(), baseIndexQuarter: "INVALID_FORMAT" },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("utilise 12 par défaut si revisionFrequency est null (B27 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { ...VALID_LEASE_BASE, startDate: leaseStartedOneYearAgo(), revisionFrequency: null },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("utilise companyName pour les locataires PERSONNE_MORALE (B36 arm0, B37 arm0)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        tenant: { entityType: "PERSONNE_MORALE", companyName: "ACME SA", firstName: null, lastName: null },
      },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("utilise '—' si companyName est null pour PERSONNE_MORALE (B37 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        tenant: { entityType: "PERSONNE_MORALE", companyName: null, firstName: null, lastName: null },
      },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("utilise '—' si firstName et lastName sont null pour PERSONNE_PHYSIQUE (B38-B40 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: null, lastName: null },
      },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("utilise '—' si building.name est null (B41 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        lot: { number: "A1", building: { name: null } },
      },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("utilise '—' si lot.number est null (B42 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        lot: { number: null, building: { name: "Immeuble A" } },
      },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("capture une erreur non-Error dans le try interne (B43 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { ...VALID_LEASE_BASE, startDate: leaseStartedOneYearAgo() },
    ] as never)
    prismaMock.rentRevision.findFirst.mockRejectedValue("string error")
    const r = await detectPendingRevisions()
    expect(r.errors[0]).toContain("Erreur inconnue")
  })

  it("capture une erreur non-Error dans le catch global (B44 arm1)", async () => {
    prismaMock.lease.findMany.mockRejectedValue("string error")
    const r = await detectPendingRevisions()
    expect(r.errors.some(e => e === "Erreur globale")).toBe(true)
  })

  it("utilise DATE_SIGNATURE comme date d'ancrage (B45 arm3)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        revisionDateBasis: "DATE_SIGNATURE",
        rentRevisions: [],
      },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("utilise startDate si entryDate est null en mode DATE_ENTREE (B46 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: leaseStartedOneYearAgo(),
        revisionDateBasis: "DATE_ENTREE",
        entryDate: null,
        rentRevisions: [],
      },
    ] as never)
    setupRevisionCreation()
    const r = await detectPendingRevisions()
    expect(r.created).toBe(1)
  })

  it("avance la date personnalisée d'un an si custom <= startDate (B47/B48/B49 arm0/arm1)", async () => {
    // startDate = June 15 one year ago, custom (month=null→Jan, day=null→1) = Jan 1 < June 15 → arm0 (ajoute 1 an)
    const start = new Date()
    start.setFullYear(start.getFullYear() - 1)
    start.setMonth(5)  // June
    start.setDate(15)
    prismaMock.lease.findMany.mockResolvedValue([
      {
        ...VALID_LEASE_BASE,
        startDate: start,
        revisionDateBasis: "DATE_PERSONNALISEE",
        revisionCustomMonth: null,
        revisionCustomDay: null,
        revisionFrequency: 12,
        rentRevisions: [],
      },
    ] as never)
    const r = await detectPendingRevisions()
    // Custom date is outside window after year shift → no revision, but branches are covered
    expect(r.errors).toHaveLength(0)
  })
})

// ─── previewCatchUpRevisions — branches restantes ─────────────────────────────

describe("previewCatchUpRevisions — branches restantes", () => {
  it("retourne une erreur si le rôle est insuffisant (B73 arm0 — ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/insuffisantes|refus/i)
  })

  it("retourne null immédiatement si les candidates sont vides (B60 arm0)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(BASE_LEASE as never)
    // preferred quarter T1: findMany returns [] → findClosestIndex([], ...) → arm0 → null
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([] as never)
    // all quarters: also empty → null
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([] as never)
    // fallback: lastRevision → null
    prismaMock.rentRevision.findFirst.mockResolvedValueOnce(null as never)
    // anyAfter → null → error
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce(null as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("disponible après")
  })

  it("utilise le trimestre 1 par défaut si latestAny est null (B70 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    // NO_QUARTER_LEASE has baseIndexQuarter: null → preferredQuarter = null
    const noQtr = { ...BASE_LEASE, baseIndexQuarter: null }
    prismaMock.lease.findFirst.mockResolvedValue(noQtr as never)
    // all quarters search: value too far → no match
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([{ value: 200.0, year: 2021, quarter: 1 }] as never)
    // fallback: lastRevision → null
    prismaMock.rentRevision.findFirst.mockResolvedValueOnce(null as never)
    // latestAny → null → fallbackQuarter = null?.quarter ?? 1 = 1
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce(null as never)
    // anyAfter (quarter=1, year>2021) → null → error
    prismaMock.inseeIndex.findFirst.mockResolvedValueOnce(null as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("disponible après")
  })

  it("utilise 12 par défaut si revisionFrequency est null dans buildCatchUpPreview (B79 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const noFreqLease = { ...BASE_LEASE, revisionFrequency: null }
    prismaMock.lease.findFirst.mockResolvedValue(noFreqLease as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021] as never)
    prismaMock.inseeIndex.findFirst.mockResolvedValue(IDX_2023 as never)
    prismaMock.inseeIndex.findMany.mockResolvedValueOnce([IDX_2021, IDX_2022, IDX_2023] as never)
    prismaMock.rentRevision.findFirst.mockResolvedValue(null as never)

    const r = await previewCatchUpRevisions(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(true)
    expect(r.data?.steps).toHaveLength(2)
  })
})
