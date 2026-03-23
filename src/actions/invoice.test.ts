import { describe, it, expect, vi } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { createInvoice, recordPayment } from "@/actions/invoice"
import { UserRole } from "@prisma/client"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email", () => ({
  sendInvoiceEmail: vi.fn().mockResolvedValue(undefined),
  sendPortalActivationEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/logo.png" } }) })) },
  })),
}))
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((v: string) => v),
  encrypt: vi.fn((v: string) => v),
  encryptBankData: vi.fn((v: string) => v),
  decryptBankData: vi.fn((v: string) => v),
}))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

const validInvoiceInput = {
  tenantId: VALID_CUID,
  invoiceType: "APPEL_LOYER" as const,
  issueDate: "2024-01-01",
  dueDate: "2024-01-31",
  lines: [{ label: "Loyer", quantity: 1, unitPrice: 1500, vatRate: 20 }],
}

describe("createInvoice", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await createInvoice("society-1", validInvoiceInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("retourne une erreur si role LECTURE (inférieur à COMPTABLE)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await createInvoice("society-1", validInvoiceInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("retourne une erreur si lines vide (validation Zod)", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await createInvoice("society-1", { ...validInvoiceInput, lines: [] })
    expect(r.success).toBe(false)
    expect(r.error).toBe("Au moins une ligne est requise")
  })
})

describe("recordPayment", () => {
  const validPayment = { invoiceId: VALID_CUID, amount: 500, paidAt: "2024-01-15" }

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated()
    const r = await recordPayment("society-1", validPayment)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("retourne une erreur si amount invalide (négatif)", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await recordPayment("society-1", { ...validPayment, amount: -1 })
    expect(r.success).toBe(false)
    expect(r.error).toBe("Le montant doit être positif")
  })

  it("retourne une erreur si amount est 0 (doit être positif)", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await recordPayment("society-1", { ...validPayment, amount: 0 })
    expect(r.success).toBe(false)
    expect(r.error).toBe("Le montant doit être positif")
  })
})
