import { describe, it, expect } from "vitest"
import { prismaMock } from "@/test/mocks/prisma"
import { hasMinRole, requireSocietyAccess, requireSuperAdmin, ForbiddenError } from "@/lib/permissions"
import { buildMembership } from "@/test/factories"
import { UserRole } from "@prisma/client"

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
    prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(UserRole.GESTIONNAIRE) as any)
    const result = await requireSocietyAccess("user-1", "society-1")
    expect(result).toBeDefined()
    expect(result.role).toBe(UserRole.GESTIONNAIRE)
  })

  it("ForbiddenError si pas de membership", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(null)
    await expect(requireSocietyAccess("user-1", "society-1")).rejects.toThrow(ForbiddenError)
  })

  it("ForbiddenError si role insuffisant", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(UserRole.LECTURE) as any)
    await expect(requireSocietyAccess("user-1", "society-1", UserRole.GESTIONNAIRE)).rejects.toThrow(ForbiddenError)
  })

  it("acces OK si role exactement egal au minRole", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(UserRole.GESTIONNAIRE) as any)
    await expect(requireSocietyAccess("user-1", "society-1", UserRole.GESTIONNAIRE)).resolves.toBeDefined()
  })
})

describe("requireSuperAdmin", () => {
  it("OK si au moins un role SUPER_ADMIN", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([buildMembership(UserRole.SUPER_ADMIN) as any])
    await expect(requireSuperAdmin("user-1")).resolves.toBe(true)
  })

  it("ForbiddenError si aucun role SUPER_ADMIN", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([buildMembership(UserRole.GESTIONNAIRE) as any])
    await expect(requireSuperAdmin("user-1")).rejects.toThrow(ForbiddenError)
  })

  it("ForbiddenError si aucun membership du tout", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([])
    await expect(requireSuperAdmin("user-1")).rejects.toThrow(ForbiddenError)
  })
})
