import { describe, it, expect } from "vitest"
import {
  createBankAccountSchema,
  createBankTransactionSchema,
} from "@/validations/bank"

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

describe("createBankAccountSchema", () => {
  const validAccount = {
    bankName: "BNP Paribas",
    accountName: "Compte principal",
    iban: "FR7630006000011234567890189",
  }

  it("valide un compte bancaire correct", () => {
    const result = createBankAccountSchema.safeParse(validAccount)
    expect(result.success).toBe(true)
  })

  it("transforme IBAN : supprime les espaces", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      iban: "FR76 3000 6000 0112 3456 7890 189",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.iban).toBe("FR7630006000011234567890189")
      expect(result.data.iban).not.toContain(" ")
    }
  })

  it("transforme IBAN : convertit en majuscules", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      iban: "fr7630006000011234567890189",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.iban).toBe("FR7630006000011234567890189")
    }
  })

  it("transforme IBAN : supprime espaces ET convertit en majuscules", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      iban: "fr76 3000 6000 0112 3456 7890 189",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.iban).toBe("FR7630006000011234567890189")
    }
  })

  it("echoue si IBAN trop court (< 15 caracteres)", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      iban: "FR7630006000",
    })
    expect(result.success).toBe(false)
  })

  it("echoue si IBAN trop long (> 34 caracteres)", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      iban: "FR76300060000112345678901890000000000",
    })
    expect(result.success).toBe(false)
  })

  it("accepte IBAN de 15 caracteres (minimum)", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      iban: "FR7630006000011",
    })
    expect(result.success).toBe(true)
  })

  it("accepte IBAN de 34 caracteres (maximum)", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      iban: "FR76300060000112345678901890000034",
    })
    expect(result.success).toBe(true)
  })

  it("applique le defaut initialBalance a 0", () => {
    const result = createBankAccountSchema.safeParse(validAccount)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.initialBalance).toBe(0)
    }
  })

  it("coerce initialBalance depuis une string", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      initialBalance: "1500.50",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.initialBalance).toBe(1500.5)
    }
  })

  it("accepte initialBalance negatif", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      initialBalance: -500,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.initialBalance).toBe(-500)
    }
  })

  it("echoue si bankName est vide", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      bankName: "",
    })
    expect(result.success).toBe(false)
  })

  it("echoue si bankName manquant", () => {
    const { bankName: _, ...noBankName } = validAccount
    const result = createBankAccountSchema.safeParse(noBankName)
    expect(result.success).toBe(false)
  })

  it("echoue si accountName est vide", () => {
    const result = createBankAccountSchema.safeParse({
      ...validAccount,
      accountName: "",
    })
    expect(result.success).toBe(false)
  })

  it("echoue si accountName manquant", () => {
    const { accountName: _, ...noAccountName } = validAccount
    const result = createBankAccountSchema.safeParse(noAccountName)
    expect(result.success).toBe(false)
  })

  it("echoue si iban manquant", () => {
    const { iban: _, ...noIban } = validAccount
    const result = createBankAccountSchema.safeParse(noIban)
    expect(result.success).toBe(false)
  })
})

describe("createBankTransactionSchema", () => {
  const validTransaction = {
    bankAccountId: VALID_CUID,
    transactionDate: "2024-03-15",
    amount: -150.75,
    label: "Virement loyer Mars",
  }

  it("valide une transaction correcte", () => {
    const result = createBankTransactionSchema.safeParse(validTransaction)
    expect(result.success).toBe(true)
  })

  it("coerce amount depuis une string", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      amount: "-150.75",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.amount).toBe(-150.75)
    }
  })

  it("accepte un amount positif", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      amount: 500,
    })
    expect(result.success).toBe(true)
  })

  it("accepte un amount negatif", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      amount: -500,
    })
    expect(result.success).toBe(true)
  })

  it("accepte un amount de 0", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      amount: 0,
    })
    expect(result.success).toBe(true)
  })

  it("echoue si label manquant", () => {
    const { label: _, ...noLabel } = validTransaction
    const result = createBankTransactionSchema.safeParse(noLabel)
    expect(result.success).toBe(false)
  })

  it("echoue si label est vide", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      label: "",
    })
    expect(result.success).toBe(false)
  })

  it("echoue si bankAccountId invalide", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      bankAccountId: "not-a-cuid",
    })
    expect(result.success).toBe(false)
  })

  it("echoue si transactionDate est vide", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      transactionDate: "",
    })
    expect(result.success).toBe(false)
  })

  it("accepte reference optionnelle", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      reference: "REF-2024-001",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reference).toBe("REF-2024-001")
    }
  })

  it("accepte reference null", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      reference: null,
    })
    expect(result.success).toBe(true)
  })

  it("accepte category optionnelle", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      category: "LOYER",
    })
    expect(result.success).toBe(true)
  })

  it("accepte category null", () => {
    const result = createBankTransactionSchema.safeParse({
      ...validTransaction,
      category: null,
    })
    expect(result.success).toBe(true)
  })
})
