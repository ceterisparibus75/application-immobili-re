import { describe, it, expect } from "vitest"
import { prismaMock } from "@/test/mocks/prisma"
import {
  hasMinRole,
  requireSocietyAccess,
  requireSuperAdmin,
  hasModulePermission,
  getEffectivePermissions,
  getUserSocieties,
  ForbiddenError,
} from "@/lib/permissions"
import { buildMembership } from "@/test/factories"
import { UserRole } from "@/generated/prisma/client"

describe("hasMinRole", () => {
  it("SUPER_ADMIN >= tous les roles", () => {
    expect(hasMinRole(UserRole.SUPER_ADMIN, UserRole.LECTURE)).toBe(true)
    expect(hasMinRole(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(true)
  })

  it("LECTURE < GESTIONNAIRE", () => {
    expect(hasMinRole(UserRole.LECTURE, UserRole.GESTIONNAIRE)).toBe(false)
  })

  it("GESTIONNAIRE >= COMPTABLE", () => {
    expect(hasMinRole(UserRole.GESTIONNAIRE, UserRole.COMPTABLE)).toBe(true)
  })
})

describe("requireSocietyAccess", () => {
  it("acces OK si membership existe", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(UserRole.GESTIONNAIRE))
    const result = await requireSocietyAccess("user-1", "society-1")
    expect(result).toBeDefined()
    expect(result.role).toBe(UserRole.GESTIONNAIRE)
  })

  it("ForbiddenError si pas de membership", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(null)
    await expect(requireSocietyAccess("user-1", "society-1")).rejects.toThrow(ForbiddenError)
  })

  it("ForbiddenError si role insuffisant", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(UserRole.LECTURE))
    await expect(requireSocietyAccess("user-1", "society-1", UserRole.GESTIONNAIRE)).rejects.toThrow(ForbiddenError)
  })

  it("acces OK si role exactement egal au minRole", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(UserRole.GESTIONNAIRE))
    await expect(requireSocietyAccess("user-1", "society-1", UserRole.GESTIONNAIRE)).resolves.toBeDefined()
  })
})

describe("requireSuperAdmin", () => {
  it("OK si au moins un role SUPER_ADMIN", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([buildMembership(UserRole.SUPER_ADMIN)])
    await expect(requireSuperAdmin("user-1")).resolves.toBe(true)
  })

  it("ForbiddenError si aucun role SUPER_ADMIN", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([buildMembership(UserRole.GESTIONNAIRE)])
    await expect(requireSuperAdmin("user-1")).rejects.toThrow(ForbiddenError)
  })

  it("ForbiddenError si aucun membership du tout", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([])
    await expect(requireSuperAdmin("user-1")).rejects.toThrow(ForbiddenError)
  })
})

// ─── hasModulePermission ──────────────────────────────────────────────────────

describe("hasModulePermission", () => {
  it("retourne true si l'utilisateur est owner de la société", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "user-1", proprietaire: null } as never)
    const r = await hasModulePermission("user-1", "society-1", "locataires", "read")
    expect(r).toBe(true)
  })

  it("retourne false si aucun membership trouvé", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "other-user", proprietaire: null } as never)
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never)
    const r = await hasModulePermission("user-1", "society-1", "locataires", "read")
    expect(r).toBe(false)
  })

  it("retourne true si le rôle GESTIONNAIRE a accès en lecture", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "other", proprietaire: null } as never)
    prismaMock.userSociety.findUnique.mockResolvedValue(
      buildMembership(UserRole.GESTIONNAIRE, { modulePermissions: null })
    )
    const r = await hasModulePermission("user-1", "society-1", "locataires", "read")
    expect(r).toBe(true)
  })
})

// ─── getEffectivePermissions ──────────────────────────────────────────────────

describe("getEffectivePermissions", () => {
  it("retourne null si l'utilisateur n'a pas de membership", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "other", proprietaire: null } as never)
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never)
    const r = await getEffectivePermissions("user-1", "society-1")
    expect(r).toBeNull()
  })

  it("retourne ADMIN_SOCIETE si l'utilisateur est le owner", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "user-1", proprietaire: null } as never)
    const r = await getEffectivePermissions("user-1", "society-1")
    expect(r?.role).toBe("ADMIN_SOCIETE")
  })

  it("retourne le rôle et les permissions réelles du membership", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: "other", proprietaire: null } as never)
    prismaMock.userSociety.findUnique.mockResolvedValue(
      buildMembership(UserRole.LECTURE, { modulePermissions: null })
    )
    const r = await getEffectivePermissions("user-1", "society-1")
    expect(r?.role).toBe(UserRole.LECTURE)
    expect(r?.permissions).toBeDefined()
  })
})

// ─── getUserSocieties ─────────────────────────────────────────────────────────

describe("getUserSocieties", () => {
  it("retourne un tableau vide si aucun membership", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([] as never)
    const r = await getUserSocieties("user-1")
    expect(r).toEqual([])
  })

  it("retourne les sociétés de l'utilisateur", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([
      { societyId: "soc-1", role: "GESTIONNAIRE", society: { id: "soc-1", name: "SCI A" } },
    ] as never)
    const r = await getUserSocieties("user-1")
    expect(r).toHaveLength(1)
  })
})
