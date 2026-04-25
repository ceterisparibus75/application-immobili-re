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
})
