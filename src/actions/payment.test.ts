import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { recordPayment } from "@/actions/invoice"
import { UserRole, InvoiceStatus } from "@/generated/prisma/client"
import { prismaMock } from "@/test/mocks/prisma"
import { buildInvoice } from "@/test/factories"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const validPayment = { invoiceId: VALID_CUID, amount: 500, paidAt: "2024-06-15" }

describe("recordPayment - paiements", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await recordPayment("society-1", validPayment)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE (minimum COMPTABLE)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await recordPayment("society-1", validPayment)
    expect(r.success).toBe(false)
  })

  it("erreur si montant negatif", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await recordPayment("society-1", { ...validPayment, amount: -100 })
    expect(r.success).toBe(false)
  })

  it("erreur si montant zero", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await recordPayment("society-1", { ...validPayment, amount: 0 })
    expect(r.success).toBe(false)
  })

  it("erreur si paidAt manquant", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await recordPayment("society-1", { ...validPayment, paidAt: "" })
    expect(r.success).toBe(false)
  })

  it("erreur si facture introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.invoice.findFirst.mockResolvedValue(null)
    const r = await recordPayment("society-1", validPayment)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Facture introuvable")
  })

  it("erreur si facture en BROUILLON", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.BROUILLON, payments: [] }) as unknown)
    const r = await recordPayment("society-1", validPayment)
    expect(r.success).toBe(false)
    expect(r.error).toContain("brouillon")
  })

  it("erreur si facture ANNULEE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.ANNULEE, payments: [] }) as unknown)
    const r = await recordPayment("society-1", validPayment)
    expect(r.success).toBe(false)
    expect(r.error).toContain("annulée")
  })

  it("paiement total met le statut a PAYE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.EN_ATTENTE, totalTTC: 1200, payments: [] }) as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 1200 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PAYE" })
    }))
  })

  it("paiement partiel met le statut a PARTIELLEMENT_PAYE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.EN_ATTENTE, totalTTC: 1200, payments: [] }) as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 600 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PARTIELLEMENT_PAYE" })
    }))
  })

  it("cumul des paiements existants + nouveau", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const existingPayments = [{ id: "pay-old", amount: 800, paidAt: new Date() }]
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.PARTIELLEMENT_PAYE, totalTTC: 1200, payments: existingPayments }) as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-2" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 400 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PAYE" })
    }))
  })

  it("cumul partiel reste PARTIELLEMENT_PAYE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const existingPayments = [{ id: "pay-old", amount: 300, paidAt: new Date() }]
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.PARTIELLEMENT_PAYE, totalTTC: 1200, payments: existingPayments }) as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-2" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 200 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PARTIELLEMENT_PAYE" })
    }))
  })

  it("paiement sur facture EN_RETARD fonctionne", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.EN_RETARD, totalTTC: 1200, payments: [] }) as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 1200 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PAYE" })
    }))
  })

  it("methode et reference optionnels", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.EN_ATTENTE, totalTTC: 1200, payments: [] }) as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 100, method: "VIREMENT", reference: "REF-123", notes: "test" })
    expect(r.success).toBe(true)
    expect(prismaMock.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ method: "VIREMENT", reference: "REF-123", notes: "test" })
    }))
  })

  it("paiement exactement egal au totalTTC met PAYE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.VALIDEE, totalTTC: 500, payments: [] }) as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 500 })
    expect(r.success).toBe(true)
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PAYE" })
    }))
  })

  it("role GESTIONNAIRE peut enregistrer un paiement", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    prismaMock.invoice.findFirst.mockResolvedValue(buildInvoice({ id: VALID_CUID, status: InvoiceStatus.EN_ATTENTE, totalTTC: 1200, payments: [] }) as unknown)
    prismaMock.payment.create.mockResolvedValue({ id: "pay-1" } as unknown)
    prismaMock.invoice.update.mockResolvedValue({} as unknown)
    const r = await recordPayment("society-1", { ...validPayment, amount: 100 })
    expect(r.success).toBe(true)
  })
})
