import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { getProprietaires, createProprietaire, deleteProprietaire } from "@/actions/proprietaire"
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
