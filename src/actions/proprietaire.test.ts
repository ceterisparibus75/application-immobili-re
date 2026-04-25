import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import {
  getProprietaires,
  createProprietaire,
  deleteProprietaire,
  getProprietaire,
  updateProprietaire,
  migrateOwnerToProprietaire,
  getProprietairesWithSocieties,
} from "@/actions/proprietaire"
import { UserRole } from "@/generated/prisma/client"
import { prismaMock } from "@/test/mocks/prisma"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const buildProprietaire = (overrides = {}) => ({
  id: "prop-1",
  userId: "user-1",
  label: "SCI Test",
  entityType: "PERSONNE_MORALE",
  email: "sci@test.com",
  firstName: null,
  lastName: null,
  phone: null,
  birthDate: null,
  birthPlace: null,
  address: "1 rue du Test",
  postalCode: "75001",
  city: "Paris",
  profession: null,
  nationality: null,
  companyName: "SCI Test",
  legalForm: "SCI",
  siret: null,
  siren: null,
  vatNumber: null,
  shareCapital: null,
  registrationCity: null,
  representativeName: null,
  representativeRole: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { societies: 0 },
  ...overrides,
})

describe("getProprietaires", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getProprietaires()
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("retourne une liste vide si aucun propriétaire", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findMany.mockResolvedValue([] as never)
    const r = await getProprietaires()
    expect(r.success).toBe(true)
    expect(r.data).toEqual([])
  })

  it("retourne les propriétaires accessibles", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findMany.mockResolvedValue([
      buildProprietaire({ _count: { societies: 2 } }),
    ] as never)
    const r = await getProprietaires()
    expect(r.success).toBe(true)
    expect(r.data).toHaveLength(1)
    expect(r.data![0].label).toBe("SCI Test")
  })
})

describe("createProprietaire", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await createProprietaire({ label: "Test" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si label vide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createProprietaire({ label: "" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("libellé")
  })

  it("erreur si label est uniquement des espaces", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await createProprietaire({ label: "   " })
    expect(r.success).toBe(false)
    expect(r.error).toContain("libellé")
  })

  it("crée un propriétaire avec un label valide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.create.mockResolvedValue(buildProprietaire() as never)
    const r = await createProprietaire({ label: "SCI Test" })
    expect(r.success).toBe(true)
    expect(r.data?.id).toBe("prop-1")
    expect(prismaMock.proprietaire.create).toHaveBeenCalled()
  })

  it("crée un propriétaire personne physique", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.create.mockResolvedValue(
      buildProprietaire({ id: "prop-2", entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Martin" }) as never
    )
    const r = await createProprietaire({
      label: "Jean Martin",
      entityType: "PERSONNE_PHYSIQUE" as never,
      firstName: "Jean",
      lastName: "Martin",
    })
    expect(r.success).toBe(true)
  })
})

describe("deleteProprietaire", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await deleteProprietaire("prop-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si propriétaire introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(null as never)
    const r = await deleteProprietaire("prop-999")
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("erreur si des sociétés sont rattachées", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(
      buildProprietaire({ _count: { societies: 2 } }) as never
    )
    const r = await deleteProprietaire("prop-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("sociétés rattachées")
  })

  it("supprime un propriétaire sans sociétés", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(
      buildProprietaire({ _count: { societies: 0 } }) as never
    )
    prismaMock.proprietaire.delete.mockResolvedValue(buildProprietaire() as never)
    const r = await deleteProprietaire("prop-1")
    expect(r.success).toBe(true)
    expect(prismaMock.proprietaire.delete).toHaveBeenCalled()
  })
})

// ── getProprietaire ───────────────────────────────────────────────

describe("getProprietaire", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getProprietaire("prop-1")
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("retourne une erreur si introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(null as never)
    const r = await getProprietaire("prop-999")
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("retourne le propriétaire si trouvé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({
      ...buildProprietaire(),
      associes: [],
    } as never)
    const r = await getProprietaire("prop-1")
    expect(r.success).toBe(true)
    expect(r.data?.id).toBe("prop-1")
    expect(r.data?.label).toBe("SCI Test")
    expect(r.data?.associes).toEqual([])
  })
})

// ── updateProprietaire ────────────────────────────────────────────

describe("updateProprietaire", () => {
  const validInput = { id: "prop-1", label: "SCI Modifiée" }

  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await updateProprietaire(validInput)
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("erreur si label vide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await updateProprietaire({ id: "prop-1", label: "" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("libellé")
  })

  it("erreur si propriétaire introuvable ou accès refusé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(null as never)
    const r = await updateProprietaire(validInput)
    expect(r.success).toBe(false)
    expect(r.error).toContain("introuvable")
  })

  it("met à jour le propriétaire avec succès", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never)
    prismaMock.proprietaire.update.mockResolvedValue(buildProprietaire({ label: "SCI Modifiée" }) as never)
    const r = await updateProprietaire(validInput)
    expect(r.success).toBe(true)
    expect(prismaMock.proprietaire.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "prop-1" }, data: expect.objectContaining({ label: "SCI Modifiée" }) })
    )
  })
})

// ── migrateOwnerToProprietaire ────────────────────────────────────

describe("migrateOwnerToProprietaire", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await migrateOwnerToProprietaire()
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("crée un propriétaire et migre les sociétés si aucun n'existe", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue(null as never)
    prismaMock.user.findUnique.mockResolvedValue({
      firstName: "Jean", lastName: "Martin", phone: null,
      birthDate: null, birthPlace: null, address: null,
      postalCode: null, ownerCity: null, profession: null, nationality: null,
    } as never)
    prismaMock.proprietaire.create.mockResolvedValue({ id: "prop-new" } as never)
    prismaMock.society.updateMany.mockResolvedValue({ count: 2 } as never)

    const r = await migrateOwnerToProprietaire()
    expect(r.success).toBe(true)
    expect(r.data?.proprietaireId).toBe("prop-new")
    expect(prismaMock.proprietaire.create).toHaveBeenCalledOnce()
    expect(prismaMock.society.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { proprietaireId: "prop-new" } })
    )
  })

  it("utilise le propriétaire existant s'il en existe un", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-existing" } as never)
    prismaMock.society.updateMany.mockResolvedValue({ count: 0 } as never)

    const r = await migrateOwnerToProprietaire()
    expect(r.success).toBe(true)
    expect(r.data?.proprietaireId).toBe("prop-existing")
    expect(prismaMock.proprietaire.create).not.toHaveBeenCalled()
  })
})

// ── getProprietairesWithSocieties ─────────────────────────────────

describe("getProprietairesWithSocieties", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await getProprietairesWithSocieties()
    expect(r.success).toBe(false)
    expect(r.error).toContain("authentif")
  })

  it("retourne la liste avec displayName calculé pour personne morale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never)
    prismaMock.society.findMany.mockResolvedValue([] as never)
    prismaMock.proprietaire.findMany.mockResolvedValue([
      {
        id: "prop-1", label: "SCI Test", entityType: "PERSONNE_MORALE",
        firstName: null, lastName: null, companyName: "SCI Test SARL", legalForm: "SARL",
        societies: [{ id: "soc-1", name: "Société A", legalForm: "SCI", city: "Paris", isActive: true, logoUrl: null }],
      },
    ] as never)

    const r = await getProprietairesWithSocieties()
    expect(r.success).toBe(true)
    expect(r.data).toHaveLength(1)
    expect(r.data![0].displayName).toBe("SCI Test SARL")
    expect(r.data![0].societies).toHaveLength(1)
  })

  it("calcule le displayName pour personne physique", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-1" } as never)
    prismaMock.society.findMany.mockResolvedValue([] as never)
    prismaMock.proprietaire.findMany.mockResolvedValue([
      {
        id: "prop-2", label: "Jean Martin", entityType: "PERSONNE_PHYSIQUE",
        firstName: "Jean", lastName: "Martin", companyName: null, legalForm: null,
        societies: [],
      },
    ] as never)

    const r = await getProprietairesWithSocieties()
    expect(r.success).toBe(true)
    expect(r.data![0].displayName).toBe("Jean Martin")
  })
})
