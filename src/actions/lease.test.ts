import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { createLease, updateLease, deleteLease } from "@/actions/lease"
import type { CreateLeaseInput } from "@/validations/lease"
import { UserRole } from "@/generated/prisma/client"
import { prismaMock } from "@/test/mocks/prisma"
import { buildTenantPhysique } from "@/test/factories"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const VALID_CUID2 = "clh3x2z4k0001qh8g7z1y2v3u"
const validLeaseInput = { lotIds: [VALID_CUID], tenantId: VALID_CUID2, leaseType: "COMMERCIAL_369" as const, startDate: "2024-01-01", durationMonths: 108, baseRentHT: 1500, depositAmount: 3000, paymentFrequency: "MENSUEL" as const, vatApplicable: true, vatRate: 20, billingTerm: "A_ECHOIR" as const, revisionFrequency: 12, rentFreeMonths: 0, entryFee: 0 } as unknown as CreateLeaseInput

describe("createLease", () => {
  it("erreur si non authentifie", async () => { mockUnauthenticated(); const r = await createLease("society-1", validLeaseInput); expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié") })
  it("erreur si role LECTURE", async () => { mockAuthSession(UserRole.LECTURE); const r = await createLease("society-1", validLeaseInput); expect(r.success).toBe(false); expect(r.error).toBe("Permissions insuffisantes pour cette action") })
  it("erreur si role COMPTABLE", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await createLease("society-1", validLeaseInput); expect(r.success).toBe(false); expect(r.error).toBe("Permissions insuffisantes pour cette action") })
  it("erreur si lotIds contient un id invalide", async () => { mockAuthSession(UserRole.GESTIONNAIRE); const r = await createLease("society-1", { ...validLeaseInput, lotIds: ["not-a-cuid"] } as unknown as CreateLeaseInput); expect(r.success).toBe(false) })
  it("erreur si startDate manquante", async () => { mockAuthSession(UserRole.GESTIONNAIRE); const r = await createLease("society-1", { ...validLeaseInput, startDate: "" } as unknown as CreateLeaseInput); expect(r.success).toBe(false) })
  it("erreur si baseRentHT negatif", async () => { mockAuthSession(UserRole.GESTIONNAIRE); const r = await createLease("society-1", { ...validLeaseInput, baseRentHT: -100 } as unknown as CreateLeaseInput); expect(r.success).toBe(false) })
  it("erreur si lot introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([])
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(false); expect(r.error).toContain("introuvable")
  })
  it("erreur si locataire introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(null)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(false); expect(r.error).toContain("Locataire introuvable")
  })
  it("erreur si lot a deja un bail actif", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([{ id: "ll-1", lotId: VALID_CUID, lot: { number: "101" } }] as never)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(false); expect(r.error).toContain("bail actif")
  })
  it("cree un bail avec succes", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([])
    prismaMock.lease.create.mockResolvedValue({ id: "lease-new" } as never)
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never)
    prismaMock.lot.update.mockResolvedValue({} as never)
    const r = await createLease("society-1", validLeaseInput)
    expect(r.success).toBe(true); expect(r.data?.id).toBe("lease-new")
  })
  it("met tous les lots en OCCUPE", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lot.findMany.mockResolvedValue([{ id: VALID_CUID, buildingId: "b1" }] as never)
    prismaMock.tenant.findFirst.mockResolvedValue(buildTenantPhysique({ id: VALID_CUID2 }) as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([])
    prismaMock.lease.create.mockResolvedValue({ id: "lease-new" } as never)
    prismaMock.lot.updateMany.mockResolvedValue({ count: 1 } as never)
    prismaMock.lot.update.mockResolvedValue({} as never)
    await createLease("society-1", validLeaseInput)
    expect(prismaMock.lot.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [VALID_CUID] } }, data: expect.objectContaining({ status: "OCCUPE" }) }))
  })
})

describe("updateLease", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await updateLease("society-1", { id: VALID_CUID })
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })
  it("erreur si bail introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue(null)
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r.success).toBe(false)
    expect(r.error).toBe("Bail introuvable")
  })
  it("resiliation met tous les lots en VACANT", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", lotId: "lot-1", status: "EN_COURS" } as never)
    prismaMock.leaseLot.findMany.mockResolvedValue([{ lotId: "lot-1" }, { lotId: "lot-2" }] as never)
    prismaMock.lot.updateMany.mockResolvedValue({ count: 2 } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r.success).toBe(true)
    expect(prismaMock.lot.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["lot-1", "lot-2"] } },
      data: expect.objectContaining({ status: "VACANT", currentRent: null })
    }))
  })
  it("ne touche pas les lots si deja resilie", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", lotId: "lot-1", status: "RESILIE" } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", { id: VALID_CUID, status: "RESILIE" })
    expect(r.success).toBe(true)
    expect(prismaMock.lot.updateMany).not.toHaveBeenCalled()
  })
  it("met a jour le loyer", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, societyId: "society-1", lotId: "lot-1", status: "EN_COURS" } as never)
    prismaMock.lease.update.mockResolvedValue({} as never)
    const r = await updateLease("society-1", { id: VALID_CUID, currentRentHT: 2000 })
    expect(r.success).toBe(true)
    expect(prismaMock.lease.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: VALID_CUID },
      data: expect.objectContaining({ currentRentHT: 2000 })
    }))
  })
})

describe("deleteLease", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })
  it("erreur si role GESTIONNAIRE (minimum ADMIN_SOCIETE)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })
  it("erreur si bail introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue(null)
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Bail introuvable")
  })
  it("erreur si bail en cours", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, status: "EN_COURS", lotId: "lot-1", leaseLots: [{ lotId: "lot-1" }] } as never)
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toContain("bail en cours")
  })
  it("supprime un bail resilie avec succes", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, status: "RESILIE", lotId: "lot-1", leaseLots: [{ lotId: "lot-1" }] } as never)
    prismaMock.lease.delete.mockResolvedValue({} as never)
    prismaMock.leaseLot.count.mockResolvedValue(0)
    prismaMock.lot.update.mockResolvedValue({} as never)
    const r = await deleteLease("society-1", VALID_CUID)
    expect(r.success).toBe(true)
    expect(prismaMock.lease.delete).toHaveBeenCalledWith({ where: { id: VALID_CUID } })
  })
  it("remet le lot en VACANT si plus de bail actif", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, status: "RESILIE", lotId: "lot-1", leaseLots: [{ lotId: "lot-1" }] } as never)
    prismaMock.lease.delete.mockResolvedValue({} as never)
    prismaMock.leaseLot.count.mockResolvedValue(0)
    prismaMock.lot.update.mockResolvedValue({} as never)
    await deleteLease("society-1", VALID_CUID)
    expect(prismaMock.lot.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "lot-1" },
      data: expect.objectContaining({ status: "VACANT" })
    }))
  })
  it("ne touche pas le lot si autres baux actifs", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.lease.findFirst.mockResolvedValue({ id: VALID_CUID, status: "RESILIE", lotId: "lot-1", leaseLots: [{ lotId: "lot-1" }] } as never)
    prismaMock.lease.delete.mockResolvedValue({} as never)
    prismaMock.leaseLot.count.mockResolvedValue(1)
    await deleteLease("society-1", VALID_CUID)
    expect(prismaMock.lot.update).not.toHaveBeenCalled()
  })
})
