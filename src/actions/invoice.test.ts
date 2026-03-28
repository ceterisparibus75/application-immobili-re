import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { createInvoice, recordPayment, generateInvoiceFromLease, createCreditNote, validateInvoice, cancelInvoice } from "@/actions/invoice"
import { UserRole, InvoiceStatus, InvoiceType } from "@/generated/prisma/client"
import { prismaMock } from "@/test/mocks/prisma"
import { buildInvoice, buildTenantPhysique } from "@/test/factories"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email", () => ({ sendInvoiceEmail: vi.fn().mockResolvedValue(undefined), sendPortalActivationEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/logo.png" } }) })) } })) }))
vi.mock("@/lib/encryption", () => ({ decrypt: vi.fn((v: string) => v), encrypt: vi.fn((v: string) => v), encryptBankData: vi.fn((v: string) => v), decryptBankData: vi.fn((v: string) => v) }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const validInvoiceInput = { tenantId: VALID_CUID, invoiceType: "APPEL_LOYER" as const, dueDate: "2024-01-31", lines: [{ label: "Loyer", quantity: 1, unitPrice: 1500, vatRate: 20 }] }
describe("createInvoice", () => {
  it("erreur si non authentifie", async () => { mockUnauthenticated(); const r = await createInvoice("society-1", validInvoiceInput); expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié") })
  it("erreur si role LECTURE", async () => { mockAuthSession(UserRole.LECTURE); const r = await createInvoice("society-1", validInvoiceInput); expect(r.success).toBe(false); expect(r.error).toBe("Permissions insuffisantes pour cette action") })
  it("erreur si lines vide", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await createInvoice("society-1", { ...validInvoiceInput, lines: [] }); expect(r.success).toBe(false); expect(r.error).toBe("Au moins une ligne est requise") })
  it("erreur si dueDate manquante", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await createInvoice("society-1", { ...validInvoiceInput, dueDate: "" }); expect(r.success).toBe(false) })
  it("erreur si tenantId invalide", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await createInvoice("society-1", { ...validInvoiceInput, tenantId: "not-a-cuid" }); expect(r.success).toBe(false) })
  it("erreur si locataire introuvable", async () => { mockAuthSession(UserRole.COMPTABLE); prismaMock.tenant.findFirst.mockResolvedValue(null); const r = await createInvoice("society-1", validInvoiceInput); expect(r.success).toBe(false); expect(r.error).toBe("Locataire introuvable") })
})
describe("recordPayment", () => {
  const validPayment = { invoiceId: VALID_CUID, amount: 500, paidAt: "2024-01-15" }
  it("erreur si non authentifie", async () => { mockUnauthenticated(); const r = await recordPayment("society-1", validPayment); expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié") })
  it("erreur si amount negatif", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await recordPayment("society-1", { ...validPayment, amount: -1 }); expect(r.success).toBe(false); expect(r.error).toBe("Le montant doit être positif") })
  it("erreur si amount est 0", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await recordPayment("society-1", { ...validPayment, amount: 0 }); expect(r.success).toBe(false); expect(r.error).toBe("Le montant doit être positif") })
  it("erreur si facture introuvable", async () => { mockAuthSession(UserRole.COMPTABLE); prismaMock.invoice.findFirst.mockResolvedValue(null); const r = await recordPayment("society-1", validPayment); expect(r.success).toBe(false); expect(r.error).toBe("Facture introuvable") })
  it("erreur si facture BROUILLON", async () => { mockAuthSession(UserRole.COMPTABLE); prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.BROUILLON, payments: [] }) as unknown); const r = await recordPayment("society-1", validPayment); expect(r.success).toBe(false); expect(r.error).toContain("brouillon ou annul") })
  it("paiement total -> PAYE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const inv = buildInvoice({ id: VALID_CUID, status: InvoiceStatus.EN_ATTENTE, totalTTC: 500, payments: [] })
    prismaMock.invoice.findFirst.mockResolvedValue(inv as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 500 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PAYE" }) }))
  })
  it("paiement partiel -> PARTIELLEMENT_PAYE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const inv = buildInvoice({ id: VALID_CUID, status: InvoiceStatus.EN_ATTENTE, totalTTC: 1000, payments: [] })
    prismaMock.invoice.findFirst.mockResolvedValue(inv as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-2" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 300 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PARTIELLEMENT_PAYE" }) }))
  })
  it("cumul paiements -> PAYE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const inv = buildInvoice({ id: VALID_CUID, status: InvoiceStatus.PARTIELLEMENT_PAYE, totalTTC: 1000, payments: [{ amount: 700 }] })
    prismaMock.invoice.findFirst.mockResolvedValue(inv as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-3" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 300 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PAYE" }) }))
  })
  it("erreur si paidAt manquant", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await recordPayment("society-1", { ...validPayment, paidAt: "" }); expect(r.success).toBe(false); expect(r.error).toContain("date") })
})
describe("generateInvoiceFromLease", () => {
  it("erreur si non authentifie", async () => { mockUnauthenticated(); const r = await generateInvoiceFromLease("society-1", { leaseId: VALID_CUID, periodMonth: "2024-01" }); expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié") })
  it("erreur si format mois invalide", async () => { mockAuthSession(UserRole.COMPTABLE); const r = await generateInvoiceFromLease("society-1", { leaseId: VALID_CUID, periodMonth: "2024-13" }); expect(r.success).toBe(false); expect(r.error).toContain("AAAA-MM") })
  it("erreur si bail introuvable", async () => { mockAuthSession(UserRole.COMPTABLE); prismaMock.lease.findFirst.mockResolvedValue(null); const r = await generateInvoiceFromLease("society-1", { leaseId: VALID_CUID, periodMonth: "2024-01" }); expect(r.success).toBe(false); expect(r.error).toBe("Bail actif introuvable") })
})

describe("validateInvoice", () => {
  it("erreur si non authentifie", async () => { mockUnauthenticated(); const r = await validateInvoice("society-1", VALID_CUID); expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié") })
  it("valide une facture brouillon", async () => { mockAuthSession(UserRole.GESTIONNAIRE); prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.BROUILLON }) as unknown); prismaMock.invoice.update.mockResolvedValue({} as unknown); const r = await validateInvoice("society-1", VALID_CUID); expect(r.success).toBe(true); expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "VALIDEE" }) })) })
})

describe("cancelInvoice", () => {
  it("erreur si non authentifie", async () => { mockUnauthenticated(); const r = await cancelInvoice("society-1", VALID_CUID); expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié") })
  it("erreur si facture introuvable", async () => { mockAuthSession(UserRole.GESTIONNAIRE); prismaMock.invoice.findFirst.mockResolvedValue(null); const r = await cancelInvoice("society-1", VALID_CUID); expect(r.success).toBe(false); expect(r.error).toBe("Facture introuvable") })
  it("annule une facture brouillon", async () => { mockAuthSession(UserRole.GESTIONNAIRE); prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.BROUILLON, lines: [], creditNotes: [] }) as unknown); prismaMock.invoice.update.mockResolvedValue({} as unknown); const r = await cancelInvoice("society-1", VALID_CUID); expect(r.success).toBe(true); expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ANNULEE" }) })) })
})

describe("createCreditNote", () => {
  const validCreditNote = { originalInvoiceId: VALID_CUID, dueDate: "2024-02-28" }
  it("erreur si non authentifie", async () => { mockUnauthenticated(); const r = await createCreditNote("society-1", validCreditNote); expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié") })
  it("erreur si facture introuvable", async () => { mockAuthSession(UserRole.COMPTABLE); prismaMock.invoice.findFirst.mockResolvedValueOnce(null); const r = await createCreditNote("society-1", validCreditNote); expect(r.success).toBe(false); expect(r.error).toBe("Facture originale introuvable") })
  it("erreur si avoir sur un avoir", async () => { mockAuthSession(UserRole.COMPTABLE); prismaMock.invoice.findFirst.mockResolvedValueOnce(buildInvoice({ id: VALID_CUID, invoiceType: InvoiceType.AVOIR, lines: [] }) as unknown); const r = await createCreditNote("society-1", validCreditNote); expect(r.success).toBe(false); expect(r.error).toContain("avoir sur un avoir") })
})
