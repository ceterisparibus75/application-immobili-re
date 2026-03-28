import { describe, it, expect, vi } from "vitest"
import { prismaMock } from "@/test/mocks/prisma"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { buildTenantPhysique } from "@/test/factories"
import { createTenant } from "@/actions/tenant"
import { UserRole } from "@/generated/prisma/client"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email", () => ({ sendPortalActivationEmail: vi.fn().mockResolvedValue(undefined) }))

describe("createTenant", () => {
  const validInput = {
    entityType: "PERSONNE_PHYSIQUE" as const,
    lastName: "Dupont",
    firstName: "Jean",
    email: "jean@example.com",
  }

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const result = await createTenant("society-1", validInput as never)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Non authentifié")
  })

  it("retourne une erreur si role LECTURE (insuffisant)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const result = await createTenant("society-1", validInput as never)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("retourne une erreur si input invalide (email manquant)", async () => {
    mockAuthSession()
    const result = await createTenant("society-1", { ...validInput, email: "" } as never)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Email invalide")
  })

  it("crée le locataire et retourne son id", async () => {
    mockAuthSession()
    const tenant = buildTenantPhysique()
    prismaMock.tenant.create.mockResolvedValue(tenant as never)
    prismaMock.auditLog.create.mockResolvedValue({} as never)
    prismaMock.tenantPortalAccess.create.mockResolvedValue({} as never)
    const result = await createTenant("society-1", validInput as never)
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe("tenant-1")
    expect(prismaMock.tenant.create).toHaveBeenCalledOnce()
  })
})
