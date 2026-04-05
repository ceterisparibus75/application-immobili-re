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
