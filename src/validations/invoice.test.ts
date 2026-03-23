import { describe, it, expect } from "vitest"
import { createInvoiceSchema, recordPaymentSchema } from "@/validations/invoice"

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

describe("createInvoiceSchema", () => {
  const validInvoice = {
    tenantId: VALID_CUID,
    invoiceType: "APPEL_LOYER" as const,
    issueDate: "2024-01-01", dueDate: "2024-01-31",
    lines: [{ label: "Loyer", quantity: 1, unitPrice: 1500, vatRate: 20 }],
  }

  it("valide une facture correcte", () => {
    expect(createInvoiceSchema.safeParse(validInvoice).success).toBe(true)
  })

  it("echoue si lines est vide", () => {
    expect(createInvoiceSchema.safeParse({ ...validInvoice, lines: [] }).success).toBe(false)
  })

  it("echoue si invoiceType invalide", () => {
    expect(createInvoiceSchema.safeParse({ ...validInvoice, invoiceType: "INCONNU" }).success).toBe(false)
  })
})

describe("recordPaymentSchema", () => {
  it("valide un paiement correct", () => {
    const r = recordPaymentSchema.safeParse({ invoiceId: VALID_CUID, amount: 500, paidAt: "2024-01-15" })
    expect(r.success).toBe(true)
  })

  it("echoue si amount <= 0", () => {
    const r = recordPaymentSchema.safeParse({ invoiceId: VALID_CUID, amount: 0, paidAt: "2024-01-15" })
    expect(r.success).toBe(false)
  })
})
