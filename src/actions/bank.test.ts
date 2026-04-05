import { describe, it, expect, vi } from "vitest"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { prismaMock } from "@/test/mocks/prisma"
import { UserRole } from "@/generated/prisma/client"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((v: string) => `encrypted_${v}`),
  decrypt: vi.fn((v: string) => v.replace("encrypted_", "")),
}))

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"
const SOCIETY_ID = "society-1"

import {
  createBankAccount,
  updateBankAccount,
  getBankAccounts,
  getBankAccountById,
  createBankTransaction,
  recalculateBankBalance,
  correctBankBalance,
} from "./bank"
import { encrypt } from "@/lib/encryption"
import { createAuditLog } from "@/lib/audit"

// ─── createBankAccount ──────────────────────────────────────────────────────

describe("createBankAccount", () => {
  const validInput = {
    bankName: "BNP Paribas",
    accountName: "Compte principal",
    iban: "FR7630006000011234567890189",
    initialBalance: 5000,
  }

  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await createBankAccount(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE (min COMPTABLE requis)", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await createBankAccount(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si bankName vide", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await createBankAccount(SOCIETY_ID, { ...validInput, bankName: "" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("banque")
  })

  it("erreur si accountName vide", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await createBankAccount(SOCIETY_ID, { ...validInput, accountName: "" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("compte")
  })

  it("erreur si IBAN trop court (< 15 chars)", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await createBankAccount(SOCIETY_ID, { ...validInput, iban: "FR76300" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("IBAN")
  })

  it("erreur si IBAN trop long (> 34 chars)", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await createBankAccount(SOCIETY_ID, {
      ...validInput,
      iban: "FR76300060000112345678901890000000000",
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain("IBAN")
  })

  it("chiffre l'IBAN avant persistence", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.create.mockResolvedValue({ id: "ba-1" } as never)

    await createBankAccount(SOCIETY_ID, validInput)

    expect(encrypt).toHaveBeenCalledWith("FR7630006000011234567890189")
    expect(prismaMock.bankAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ibanEncrypted: "encrypted_FR7630006000011234567890189",
        }),
      })
    )
  })

  it("initialise currentBalance au meme montant que initialBalance", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.create.mockResolvedValue({ id: "ba-1" } as never)

    await createBankAccount(SOCIETY_ID, validInput)

    expect(prismaMock.bankAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          initialBalance: 5000,
          currentBalance: 5000,
        }),
      })
    )
  })

  it("succes avec creation et audit log", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.create.mockResolvedValue({ id: "ba-1" } as never)

    const r = await createBankAccount(SOCIETY_ID, validInput)

    expect(r.success).toBe(true)
    expect(r.data).toEqual({ id: "ba-1" })
    expect(prismaMock.bankAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: SOCIETY_ID,
          bankName: "BNP Paribas",
          accountName: "Compte principal",
        }),
      })
    )
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "BankAccount",
        entityId: "ba-1",
        details: expect.objectContaining({
          bankName: "BNP Paribas",
          accountName: "Compte principal",
        }),
      })
    )
  })

  it("normalise l'IBAN (supprime espaces, majuscules)", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.create.mockResolvedValue({ id: "ba-2" } as never)

    await createBankAccount(SOCIETY_ID, {
      ...validInput,
      iban: "fr76 3000 6000 0112 3456 7890 189",
    })

    // Zod transform removes spaces and uppercases
    expect(encrypt).toHaveBeenCalledWith("FR7630006000011234567890189")
  })
})

// ─── updateBankAccount ──────────────────────────────────────────────────────

describe("updateBankAccount", () => {
  const validInput = { id: VALID_CUID, bankName: "Societe Generale" }

  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await updateBankAccount(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await updateBankAccount(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si compte introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.findFirst.mockResolvedValue(null)

    const r = await updateBankAccount(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Compte introuvable")
  })

  it("succes avec mise a jour et audit log", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: SOCIETY_ID,
    } as never)
    prismaMock.bankAccount.update.mockResolvedValue({} as never)

    const r = await updateBankAccount(SOCIETY_ID, validInput)

    expect(r.success).toBe(true)
    expect(prismaMock.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_CUID },
        data: expect.objectContaining({ bankName: "Societe Generale" }),
      })
    )
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "BankAccount",
        entityId: VALID_CUID,
      })
    )
  })
})

// ─── getBankAccounts ────────────────────────────────────────────────────────

describe("getBankAccounts", () => {
  it("retourne tableau vide si non authentifie", async () => {
    mockUnauthenticated()
    const r = await getBankAccounts(SOCIETY_ID)
    expect(r).toEqual([])
  })

  it("retourne les comptes avec IBAN masque", async () => {
    mockAuthSession(UserRole.LECTURE)
    prismaMock.bankAccount.findMany.mockResolvedValue([
      {
        id: "ba-1",
        societyId: SOCIETY_ID,
        bankName: "BNP",
        accountName: "Compte",
        ibanEncrypted: "encrypted_FR7630006000011234567890189",
        _count: { transactions: 5 },
      },
    ] as never)

    const r = await getBankAccounts(SOCIETY_ID)

    expect(r).toHaveLength(1)
    expect(r[0].ibanMasked).toBe("FR76 **** **** 0189")
    expect(r[0].bankName).toBe("BNP")
  })

  it("retourne IBAN masque '****' si dechiffrement echoue", async () => {
    mockAuthSession(UserRole.LECTURE)
    // Mock decrypt to throw for this test
    const { decrypt } = await import("@/lib/encryption")
    vi.mocked(decrypt).mockImplementationOnce(() => {
      throw new Error("decryption failed")
    })
    prismaMock.bankAccount.findMany.mockResolvedValue([
      {
        id: "ba-2",
        ibanEncrypted: "corrupted_data",
        _count: { transactions: 0 },
      },
    ] as never)

    const r = await getBankAccounts(SOCIETY_ID)

    expect(r).toHaveLength(1)
    expect(r[0].ibanMasked).toBe("****")
  })
})

// ─── getBankAccountById ─────────────────────────────────────────────────────

describe("getBankAccountById", () => {
  it("retourne null si non authentifie", async () => {
    mockUnauthenticated()
    const r = await getBankAccountById(SOCIETY_ID, "ba-1")
    expect(r).toBeNull()
  })

  it("retourne null si compte introuvable", async () => {
    mockAuthSession(UserRole.LECTURE)
    prismaMock.bankAccount.findFirst.mockResolvedValue(null as never)
    prismaMock.bankTransaction.count.mockResolvedValue(0 as never)

    const r = await getBankAccountById(SOCIETY_ID, "ba-nonexistent")
    expect(r).toBeNull()
  })

  it("succes avec IBAN dechiffre et unreconciledCount", async () => {
    mockAuthSession(UserRole.LECTURE)
    prismaMock.bankAccount.findFirst.mockResolvedValue({
      id: "ba-1",
      societyId: SOCIETY_ID,
      ibanEncrypted: "encrypted_FR7630006000011234567890189",
      transactions: [],
      connection: null,
      _count: { transactions: 10 },
    } as never)
    prismaMock.bankTransaction.count.mockResolvedValue(3 as never)

    const r = await getBankAccountById(SOCIETY_ID, "ba-1")

    expect(r).not.toBeNull()
    expect(r!.ibanMasked).toBe("FR76 **** **** 0189")
    expect(r!.unreconciledCount).toBe(3)
  })
})

// ─── createBankTransaction ──────────────────────────────────────────────────

describe("createBankTransaction", () => {
  const validInput = {
    bankAccountId: VALID_CUID,
    transactionDate: "2026-03-15",
    amount: -150.5,
    label: "Taxe fonciere",
    reference: "TF-2026",
    category: "IMPOT",
  }

  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await createBankTransaction(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await createBankTransaction(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si label vide", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await createBankTransaction(SOCIETY_ID, { ...validInput, label: "" })
    expect(r.success).toBe(false)
    expect(r.error).toContain("libellé")
  })

  it("erreur si transactionDate vide", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await createBankTransaction(SOCIETY_ID, {
      ...validInput,
      transactionDate: "",
    })
    expect(r.success).toBe(false)
  })

  it("erreur si compte introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.findFirst.mockResolvedValue(null)

    const r = await createBankTransaction(SOCIETY_ID, validInput)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Compte introuvable")
  })

  it("succes avec creation, increment du solde et audit log", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: SOCIETY_ID,
    } as never)
    prismaMock.bankTransaction.create.mockResolvedValue({ id: "tx-1" } as never)
    prismaMock.bankAccount.update.mockResolvedValue({} as never)

    const r = await createBankTransaction(SOCIETY_ID, validInput)

    expect(r.success).toBe(true)
    expect(r.data).toEqual({ id: "tx-1" })

    // Verify transaction creation
    expect(prismaMock.bankTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bankAccountId: VALID_CUID,
          amount: -150.5,
          label: "Taxe fonciere",
          reference: "TF-2026",
          category: "IMPOT",
        }),
      })
    )

    // Verify balance update via increment
    expect(prismaMock.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_CUID },
        data: { currentBalance: { increment: -150.5 } },
      })
    )

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "BankTransaction",
        entityId: "tx-1",
        details: expect.objectContaining({ amount: -150.5, label: "Taxe fonciere" }),
      })
    )
  })

  it("gere reference et category null", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.findFirst.mockResolvedValue({
      id: VALID_CUID,
      societyId: SOCIETY_ID,
    } as never)
    prismaMock.bankTransaction.create.mockResolvedValue({ id: "tx-2" } as never)
    prismaMock.bankAccount.update.mockResolvedValue({} as never)

    const r = await createBankTransaction(SOCIETY_ID, {
      bankAccountId: VALID_CUID,
      transactionDate: "2026-01-01",
      amount: 1000,
      label: "Virement loyer",
    })

    expect(r.success).toBe(true)
    expect(prismaMock.bankTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reference: null,
          category: null,
        }),
      })
    )
  })
})

// ─── recalculateBankBalance ─────────────────────────────────────────────────

describe("recalculateBankBalance", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await recalculateBankBalance(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const r = await recalculateBankBalance(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si compte introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.findFirst.mockResolvedValue(null)

    const r = await recalculateBankBalance(SOCIETY_ID, VALID_CUID)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Compte introuvable")
  })

  it("recalcule le solde = initialBalance + sum(transactions)", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.findFirst.mockResolvedValue({
      id: VALID_CUID,
      initialBalance: 10000,
      currentBalance: 9999, // stale value
    } as never)
    prismaMock.bankTransaction.aggregate.mockResolvedValue({
      _sum: { amount: -2500 },
    } as never)
    prismaMock.bankAccount.update.mockResolvedValue({} as never)

    const r = await recalculateBankBalance(SOCIETY_ID, VALID_CUID)

    expect(r.success).toBe(true)
    expect(r.data).toEqual({ newBalance: 7500 })
    expect(prismaMock.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_CUID },
        data: { currentBalance: 7500 },
      })
    )
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "BankAccount",
        details: expect.objectContaining({
          action: "recalculate_balance",
          oldBalance: 9999,
          newBalance: 7500,
        }),
      })
    )
  })

  it("gere le cas sans transactions (sum null)", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    prismaMock.bankAccount.findFirst.mockResolvedValue({
      id: VALID_CUID,
      initialBalance: 5000,
      currentBalance: 5000,
    } as never)
    prismaMock.bankTransaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    } as never)
    prismaMock.bankAccount.update.mockResolvedValue({} as never)

    const r = await recalculateBankBalance(SOCIETY_ID, VALID_CUID)

    expect(r.success).toBe(true)
    expect(r.data).toEqual({ newBalance: 5000 })
  })
})

// ─── correctBankBalance ─────────────────────────────────────────────────────

describe("correctBankBalance", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await correctBankBalance(SOCIETY_ID, VALID_CUID, 10000)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role GESTIONNAIRE (min ADMIN_SOCIETE requis)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE)
    const r = await correctBankBalance(SOCIETY_ID, VALID_CUID, 10000)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si role COMPTABLE", async () => {
    mockAuthSession(UserRole.COMPTABLE)
    const r = await correctBankBalance(SOCIETY_ID, VALID_CUID, 10000)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Permissions insuffisantes pour cette action")
  })

  it("erreur si compte introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.bankAccount.findFirst.mockResolvedValue(null)

    const r = await correctBankBalance(SOCIETY_ID, VALID_CUID, 10000)
    expect(r.success).toBe(false)
    expect(r.error).toBe("Compte introuvable")
  })

  it("ajuste initialBalance pour atteindre le solde cible", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.bankAccount.findFirst.mockResolvedValue({
      id: VALID_CUID,
      initialBalance: 5000,
      currentBalance: 7500,
    } as never)
    prismaMock.bankTransaction.aggregate.mockResolvedValue({
      _sum: { amount: 2500 },
    } as never)
    prismaMock.bankAccount.update.mockResolvedValue({} as never)

    // Target: 12000, txSum: 2500 => newInitialBalance = 12000 - 2500 = 9500
    const r = await correctBankBalance(SOCIETY_ID, VALID_CUID, 12000)

    expect(r.success).toBe(true)
    expect(r.data).toEqual({ newBalance: 12000 })
    expect(prismaMock.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_CUID },
        data: { initialBalance: 9500, currentBalance: 12000 },
      })
    )
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "BankAccount",
        details: expect.objectContaining({
          action: "correct_balance",
          oldBalance: 7500,
          newBalance: 12000,
          oldInitialBalance: 5000,
          newInitialBalance: 9500,
        }),
      })
    )
  })

  it("gere le cas sans transactions (sum null)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE)
    prismaMock.bankAccount.findFirst.mockResolvedValue({
      id: VALID_CUID,
      initialBalance: 0,
      currentBalance: 0,
    } as never)
    prismaMock.bankTransaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    } as never)
    prismaMock.bankAccount.update.mockResolvedValue({} as never)

    // Target: 3000, txSum: 0 => newInitialBalance = 3000
    const r = await correctBankBalance(SOCIETY_ID, VALID_CUID, 3000)

    expect(r.success).toBe(true)
    expect(r.data).toEqual({ newBalance: 3000 })
    expect(prismaMock.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { initialBalance: 3000, currentBalance: 3000 },
      })
    )
  })
})
