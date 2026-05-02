import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
// generateAndSendQuittance est appelé de façon asynchrone dans reconcileWithInvoice
vi.mock("@/actions/invoice", () => ({
  generateAndSendQuittance: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  autoReconcile,
  manualReconcile,
  unreconcile,
  getUnreconciledTransactions,
  getUnreconciledPayments,
  getReconciledItems,
  getPendingInvoices,
  getUpcomingLoanLines,
  reconcileWithInvoice,
  reconcileWithLoanLine,
  generateJournalEntry,
} from "./bank-reconciliation";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const SOCIETY_ID = "society-1";
// IDs au format CUID : commence par 'c', min 9 chars, pas de tiret
const ACCOUNT_ID = "caccount01";
const TX_ID = "ctransact01";
const PAYMENT_ID = "cpayment01";
const RECONCIL_ID = "creconci01";

const buildAccount = (overrides = {}) => ({
  id: ACCOUNT_ID,
  societyId: SOCIETY_ID,
  accountName: "Compte principal",
  iban: null,
  currentBalance: 5000,
  ...overrides,
});

const buildTransaction = (overrides = {}) => ({
  id: TX_ID,
  bankAccountId: ACCOUNT_ID,
  isReconciled: false,
  amount: 500,
  transactionDate: new Date("2026-03-01"),
  reference: "REF-001",
  label: "Virement entrant",
  ...overrides,
});

const buildPayment = (overrides = {}) => ({
  id: PAYMENT_ID,
  amount: 500,
  paidAt: new Date("2026-03-01"),
  isReconciled: false,
  reference: "REF-001",
  invoiceId: "cinvoice01",
  invoice: { isThirdPartyManaged: false, expectedNetAmount: null },
  ...overrides,
});

// ─── autoReconcile ────────────────────────────────────────────────────────────

describe("autoReconcile", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min COMPTABLE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si compte introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(null);
    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Compte introuvable");
  });

  it("retourne matched = 0 si aucune transaction à rapprocher", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(buildAccount() as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([]);
    prismaMock.payment.findMany.mockResolvedValue([]);

    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(true);
    expect(r.data?.matched).toBe(0);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entity: "BankAccount" })
    );
  });

  it("rapproche avec un match exact (référence + montant) — lignes 121-135", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(buildAccount() as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      buildTransaction({ amount: 500, reference: "REF-001" }),
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      buildPayment({ amount: 500, reference: "REF-001" }),
    ] as never);
    prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as never);

    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(true);
    expect(r.data?.matched).toBe(1);
  });

  it("crée l'écriture BQUE lors d'un rapprochement automatique exact", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(buildAccount() as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      buildTransaction({ amount: 500, reference: "REF-001", journalEntryId: null }),
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      buildPayment({
        amount: 500,
        reference: "REF-001",
        invoice: { isThirdPartyManaged: false, expectedNetAmount: null, managementFeeTTC: null },
      }),
    ] as never);
    prismaMock.accountingAccount.upsert
      .mockResolvedValueOnce({ id: "account-512", code: "512", label: "Banque", type: "5" } as never)
      .mockResolvedValueOnce({ id: "account-411", code: "411", label: "Clients", type: "4" } as never)
      .mockResolvedValueOnce({ id: "account-658", code: "658", label: "Charges diverses", type: "6" } as never)
      .mockResolvedValueOnce({ id: "account-622", code: "622", label: "Honoraires", type: "6" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fnOrQueries: ((tx: typeof prismaMock) => Promise<unknown>) | unknown[]) =>
      Array.isArray(fnOrQueries) ? fnOrQueries : fnOrQueries(prismaMock)
    );

    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);

    expect(r.success).toBe(true);
    expect(r.data?.matched).toBe(1);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "BQUE",
          lines: {
            create: [
              { accountId: "account-512", debit: 500, credit: 0, label: "Virement entrant" },
              { accountId: "account-411", debit: 0, credit: 500, label: "Virement entrant" },
            ],
          },
        }),
      })
    );
    expect(prismaMock.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: TX_ID },
      data: { isReconciled: true, journalEntryId: JOURNAL_ID },
    });
  });

  it("rapproche avec un match approximatif (montant ±0.01 + date ±3j) — lignes 139-155", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(buildAccount() as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      buildTransaction({ amount: 500, reference: "TX-REF", transactionDate: new Date("2026-03-01") }),
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      buildPayment({ amount: 500.005, reference: "PAY-REF", paidAt: new Date("2026-03-02") }),
    ] as never);
    prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as never);

    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(true);
    expect(r.data?.matched).toBe(1);
  });

  it("rapproche avec le montant net pour gestion tiers — lignes 158-169", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(buildAccount() as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      buildTransaction({ amount: 460, reference: null }),
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      buildPayment({ amount: 500, reference: null, invoice: { isThirdPartyManaged: true, expectedNetAmount: 460 } }),
    ] as never);
    prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as never);

    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(true);
    expect(r.data?.matched).toBe(1);
  });

  it("ignore les débits bancaires pour les paiements locataires", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(buildAccount() as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      buildTransaction({ amount: -500, reference: "REF-001" }),
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      buildPayment({ amount: 500, reference: "REF-001" }),
    ] as never);

    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(true);
    expect(r.data?.matched).toBe(0);
  });

  it("retourne une erreur générique si la BDD échoue dans autoReconcile (lignes 193-194)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockRejectedValue(new Error("DB error"));
    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors du rapprochement automatique" });
  });

  it("ignore une transaction dont l'id est déjà utilisé (ligne 118)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(buildAccount() as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      buildTransaction({ id: "ctx-dup01", amount: 500, reference: "REF-DUP" }),
      buildTransaction({ id: "ctx-dup01", amount: 500, reference: "REF-DUP" }),
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      buildPayment({ id: "cpay-dup1", amount: 500, reference: "REF-DUP" }),
    ] as never);
    prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as never);
    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(true);
    expect(r.data?.matched).toBe(1);
  });

  it("couvre lignes 140, 159, 160 : paiement déjà utilisé et invoice non-tiers", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankAccount.findFirst.mockResolvedValue(buildAccount() as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      buildTransaction({ id: "ctx-first1", amount: 500, reference: "REF-AAA" }),
      buildTransaction({ id: "ctx-secon1", amount: 500, reference: null }),
    ] as never);
    prismaMock.payment.findMany.mockResolvedValue([
      buildPayment({ id: "cpay-aaa1", amount: 500, reference: "REF-AAA", invoice: { isThirdPartyManaged: false, expectedNetAmount: null } }),
      buildPayment({ id: "cpay-bbb1", amount: 999, reference: null, paidAt: new Date("2026-03-01"), invoice: { isThirdPartyManaged: false, expectedNetAmount: null } }),
    ] as never);
    prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as never);
    const r = await autoReconcile(SOCIETY_ID, ACCOUNT_ID);
    expect(r.success).toBe(true);
    expect(r.data?.matched).toBe(1);
  });
});

// ─── manualReconcile ──────────────────────────────────────────────────────────

describe("manualReconcile", () => {
  const validInput = { transactionId: TX_ID, paymentId: PAYMENT_ID };

  beforeEach(() => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(buildTransaction() as never);
    prismaMock.payment.findFirst.mockResolvedValue(buildPayment() as never);
    prismaMock.bankReconciliation.create.mockResolvedValue({ id: RECONCIL_ID } as never);
    prismaMock.bankTransaction.update.mockResolvedValue(buildTransaction({ isReconciled: true }) as never);
    prismaMock.payment.update.mockResolvedValue(buildPayment({ isReconciled: true }) as never);
    prismaMock.accountingAccount.upsert.mockResolvedValue({ id: "account-default" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fnOrQueries: ((tx: typeof prismaMock) => Promise<unknown>) | unknown[]) =>
      Array.isArray(fnOrQueries) ? fnOrQueries : fnOrQueries(prismaMock)
    );
    prismaMock.invoice.findUnique.mockResolvedValue(null);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min COMPTABLE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("erreur si transactionId n'est pas un CUID", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await manualReconcile(SOCIETY_ID, { transactionId: "bad-id", paymentId: PAYMENT_ID });
    expect(r.success).toBe(false);
  });

  it("erreur si transaction introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockResolvedValue(null);
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Transaction introuvable ou déjà rapprochée");
  });

  it("ne charge que les transactions non rapprochées", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(prismaMock.bankTransaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TX_ID,
          isReconciled: false,
        }),
      })
    );
  });

  it("refuse de rapprocher un paiement locataire avec un débit bancaire", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockResolvedValue(buildTransaction({ amount: -500 }) as never);

    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/créditrice/i);
  });

  it("erreur si paiement introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.payment.findFirst.mockResolvedValue(null);
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Paiement introuvable");
  });

  it("refuse un rapprochement manuel si le montant ne correspond pas au paiement", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.payment.findFirst.mockResolvedValue(buildPayment({ amount: 450 }) as never);

    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/montant/i);
  });

  it("crée le rapprochement et l'audit log", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(prismaMock.bankReconciliation.create).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "BankReconciliation" })
    );
  });

  it("crée l'écriture BQUE lors d'un rapprochement manuel avec paiement existant", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockResolvedValue(
      buildTransaction({ amount: 500, journalEntryId: null }) as never
    );
    prismaMock.payment.findFirst.mockResolvedValue(
      buildPayment({
        invoice: { isThirdPartyManaged: false, expectedNetAmount: null, managementFeeTTC: null },
      }) as never
    );
    prismaMock.accountingAccount.upsert
      .mockResolvedValueOnce({ id: "account-512", code: "512", label: "Banque", type: "5" } as never)
      .mockResolvedValueOnce({ id: "account-411", code: "411", label: "Clients", type: "4" } as never)
      .mockResolvedValueOnce({ id: "account-658", code: "658", label: "Charges diverses", type: "6" } as never)
      .mockResolvedValueOnce({ id: "account-622", code: "622", label: "Honoraires", type: "6" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fnOrQueries: ((tx: typeof prismaMock) => Promise<unknown>) | unknown[]) =>
      Array.isArray(fnOrQueries) ? fnOrQueries : fnOrQueries(prismaMock)
    );

    const r = await manualReconcile(SOCIETY_ID, validInput);

    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "BQUE",
          lines: {
            create: [
              { accountId: "account-512", debit: 500, credit: 0, label: "Virement entrant" },
              { accountId: "account-411", debit: 0, credit: 500, label: "Virement entrant" },
            ],
          },
        }),
      })
    );
    expect(prismaMock.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: TX_ID },
      data: { isReconciled: true, journalEntryId: JOURNAL_ID },
    });
  });

  it("revalide le chemin locataire si invoice.tenantId trouvé (ligne 258)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.invoice.findUnique.mockResolvedValue({ tenantId: "ctenant001" } as never);
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
  });

  it("retourne une erreur générique si la BDD échoue dans manualReconcile (lignes 266-267)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockRejectedValue(new Error("DB error"));
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r).toEqual({ success: false, error: "Erreur lors du rapprochement" });
  });

  it("ne tente pas de récupérer l'invoice si invoiceId est null (B19 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.payment.findFirst.mockResolvedValue(buildPayment({ invoiceId: null }) as never);
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(prismaMock.invoice.findUnique).not.toHaveBeenCalled();
  });
});

// ─── unreconcile ──────────────────────────────────────────────────────────────

describe("unreconcile", () => {
  const buildReconciliation = () => ({
    id: RECONCIL_ID,
    transactionId: TX_ID,
    paymentId: PAYMENT_ID,
    transaction: { bankAccountId: ACCOUNT_ID, journalEntryId: null, journalEntry: null },
  });

  beforeEach(() => {
    prismaMock.bankReconciliation.findFirst.mockResolvedValue(buildReconciliation() as never);
    prismaMock.$transaction.mockResolvedValue([{}, {}, {}] as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await unreconcile(SOCIETY_ID, RECONCIL_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min COMPTABLE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await unreconcile(SOCIETY_ID, RECONCIL_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si rapprochement introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankReconciliation.findFirst.mockResolvedValue(null);
    const r = await unreconcile(SOCIETY_ID, RECONCIL_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Rapprochement introuvable");
  });

  it("annule le rapprochement et crée un audit log", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await unreconcile(SOCIETY_ID, RECONCIL_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "BankReconciliation" })
    );
  });

  it("supprime l'écriture BQUE brouillon liée lors du dérapprochement", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankReconciliation.findFirst.mockResolvedValue({
      ...buildReconciliation(),
      transaction: {
        bankAccountId: ACCOUNT_ID,
        journalEntryId: JOURNAL_ID,
        journalEntry: { id: JOURNAL_ID, status: "BROUILLON", isValidated: false },
      },
    } as never);
    prismaMock.$transaction.mockImplementation(async (fnOrQueries: ((tx: typeof prismaMock) => Promise<unknown>) | unknown[]) =>
      Array.isArray(fnOrQueries) ? fnOrQueries : fnOrQueries(prismaMock)
    );

    const r = await unreconcile(SOCIETY_ID, RECONCIL_ID);

    expect(r.success).toBe(true);
    expect(prismaMock.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: TX_ID },
      data: { isReconciled: false, journalEntryId: null },
    });
    expect(prismaMock.journalEntry.delete).toHaveBeenCalledWith({ where: { id: JOURNAL_ID } });
  });

  it("refuse le dérapprochement si l'écriture BQUE liée est validée", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankReconciliation.findFirst.mockResolvedValue({
      ...buildReconciliation(),
      transaction: {
        bankAccountId: ACCOUNT_ID,
        journalEntryId: JOURNAL_ID,
        journalEntry: { id: JOURNAL_ID, status: "VALIDEE", isValidated: true },
      },
    } as never);

    const r = await unreconcile(SOCIETY_ID, RECONCIL_ID);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/écriture comptable est validée/);
    expect(prismaMock.bankReconciliation.delete).not.toHaveBeenCalled();
    expect(prismaMock.journalEntry.delete).not.toHaveBeenCalled();
  });

  it("retourne une erreur générique si la BDD échoue dans unreconcile (lignes 318-319)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankReconciliation.findFirst.mockRejectedValue(new Error("DB error"));
    const r = await unreconcile(SOCIETY_ID, RECONCIL_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de l'annulation" });
  });
});

// ─── getUnreconciledTransactions ──────────────────────────────────────────────

describe("getUnreconciledTransactions", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getUnreconciledTransactions(SOCIETY_ID, ACCOUNT_ID);
    expect(r).toEqual([]);
  });

  it("retourne les transactions non rapprochées", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      { id: TX_ID, isReconciled: false, amount: -500, journalEntryId: JOURNAL_ID },
    ] as never);
    const r = await getUnreconciledTransactions(SOCIETY_ID, ACCOUNT_ID);
    expect(r).toHaveLength(1);
    expect(r[0].journalEntryId).toBe(JOURNAL_ID);
    expect(prismaMock.bankTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ journalEntryId: true }),
      })
    );
  });
});

// ─── getUnreconciledPayments ──────────────────────────────────────────────────

describe("getUnreconciledPayments", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getUnreconciledPayments(SOCIETY_ID);
    expect(r).toEqual([]);
  });

  it("retourne les paiements non rapprochés", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.payment.findMany.mockResolvedValue([
      { id: PAYMENT_ID, isReconciled: false, amount: 500 },
    ] as never);
    const r = await getUnreconciledPayments(SOCIETY_ID);
    expect(r).toHaveLength(1);
  });
});

// ─── getReconciledItems ───────────────────────────────────────────────────────

describe("getReconciledItems", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getReconciledItems(SOCIETY_ID, ACCOUNT_ID);
    expect(r).toEqual([]);
  });

  it("retourne les rapprochements", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.bankReconciliation.findMany.mockResolvedValue([
      {
        id: RECONCIL_ID,
        isValidated: true,
        transaction: { id: TX_ID, journalEntryId: JOURNAL_ID },
      },
    ] as never);
    const r = await getReconciledItems(SOCIETY_ID, ACCOUNT_ID);
    expect(r).toHaveLength(1);
    expect(r[0].transaction.id).toBe(TX_ID);
    expect(r[0].transaction.journalEntryId).toBe(JOURNAL_ID);
    expect(prismaMock.bankReconciliation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          transaction: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              journalEntryId: true,
            }),
          }),
        }),
      })
    );
  });
});

// ─── getPendingInvoices ───────────────────────────────────────────────────────

describe("getPendingInvoices", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getPendingInvoices(SOCIETY_ID);
    expect(r).toEqual([]);
  });

  it("retourne les factures en attente", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: "cinvoice01", status: "VALIDEE", invoiceType: "APPEL_LOYER", totalTTC: 500, payments: [{ amount: 150 }] },
    ] as never);
    const r = await getPendingInvoices(SOCIETY_ID);
    expect(r).toHaveLength(1);
    expect(r[0].totalTTC).toBe(350);
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: expect.arrayContaining(["VALIDEE", "ENVOYEE"]) },
        }),
      })
    );
  });
});

// ─── getUpcomingLoanLines ─────────────────────────────────────────────────────

describe("getUpcomingLoanLines", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getUpcomingLoanLines(SOCIETY_ID);
    expect(r).toEqual([]);
  });

  it("retourne uniquement les échéances de prêt échues non payées", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.loanAmortizationLine.findMany.mockResolvedValue([
      { id: "cloanline01", isPaid: false, dueDate: new Date() },
    ] as never);
    const r = await getUpcomingLoanLines(SOCIETY_ID);
    expect(r).toHaveLength(1);
    expect(prismaMock.loanAmortizationLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPaid: false,
          dueDate: { lte: expect.any(Date) },
        }),
      })
    );
  });
});

// ─── reconcileWithInvoice ─────────────────────────────────────────────────────

const LOAN_LINE_ID = "cloanline01";
const INVOICE_ID = "cinvoice01";

describe("reconcileWithInvoice", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockResolvedValue(buildTransaction() as never);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID, totalTTC: 500, invoiceType: "APPEL_LOYER",
      isThirdPartyManaged: false, expectedNetAmount: null, tenantId: "ctenant001",
    } as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as never);
    prismaMock.accountingAccount.upsert.mockResolvedValue({ id: "account-default" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
    prismaMock.$transaction.mockResolvedValue(undefined as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si transaction introuvable", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(null as never);
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Transaction introuvable");
  });

  it("erreur si facture introuvable", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null as never);
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Facture introuvable");
  });

  it("refuse de créer un paiement de facture depuis un débit bancaire", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(buildTransaction({ amount: -500 }) as never);

    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/créditrice/i);
  });

  it("rapproche avec succès", async () => {
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "BankReconciliation" })
    );
  });

  it("crée l'écriture BQUE lors du rapprochement avec une facture", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(
      buildTransaction({ amount: 500, journalEntryId: null }) as never
    );
    prismaMock.accountingAccount.upsert
      .mockResolvedValueOnce({ id: "account-512", code: "512", label: "Banque", type: "5" } as never)
      .mockResolvedValueOnce({ id: "account-411", code: "411", label: "Clients", type: "4" } as never)
      .mockResolvedValueOnce({ id: "account-658", code: "658", label: "Charges diverses", type: "6" } as never)
      .mockResolvedValueOnce({ id: "account-622", code: "622", label: "Honoraires", type: "6" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.payment.create.mockResolvedValue({ id: PAYMENT_ID } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);
    prismaMock.bankReconciliation.create.mockResolvedValue({} as never);
    prismaMock.bankTransaction.update.mockResolvedValue({} as never);

    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);

    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "BQUE",
          lines: {
            create: [
              { accountId: "account-512", debit: 500, credit: 0, label: "Virement entrant" },
              { accountId: "account-411", debit: 0, credit: 500, label: "Virement entrant" },
            ],
          },
        }),
      })
    );
    expect(prismaMock.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: TX_ID },
      data: { isReconciled: true, journalEntryId: JOURNAL_ID },
    });
  });

  it("retourne une erreur si rôle insuffisant pour reconcileWithInvoice (ForbiddenError ligne 589)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans reconcileWithInvoice (lignes 590-591)", async () => {
    prismaMock.bankTransaction.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors du rapprochement" });
  });

  it("log l'erreur si la génération de quittance auto échoue silencieusement (ligne 582)", async () => {
    const { generateAndSendQuittance } = await import("@/actions/invoice");
    vi.mocked(generateAndSendQuittance).mockRejectedValueOnce(new Error("quittance KO"));
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.payment.create.mockResolvedValue({ id: "cpayment03" } as never);
    prismaMock.invoice.update.mockResolvedValue({ invoiceType: "APPEL_LOYER", status: "PAYE" } as never);
    prismaMock.bankReconciliation.create.mockResolvedValue({} as never);
    prismaMock.bankTransaction.update.mockResolvedValue({} as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 500 } } as never);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
    await vi.runAllTimersAsync().catch(() => {});
    consoleSpy.mockRestore();
  });

  it("exécute le callback $transaction dans reconcileWithInvoice (lignes 536, 546-547, 556)", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.payment.create.mockResolvedValue({ id: "cpayment02" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);
    prismaMock.bankReconciliation.create.mockResolvedValue({} as never);
    prismaMock.bankTransaction.update.mockResolvedValue({} as never);

    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.payment.create).toHaveBeenCalled();
    expect(prismaMock.invoice.update).toHaveBeenCalled();
  });

  it("utilise le montant net attendu pour gestion tiers (targetAmount = expectedNetAmount)", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID, totalTTC: 800, invoiceType: "APPEL_LOYER",
      isThirdPartyManaged: true, expectedNetAmount: 460, tenantId: "ctenant001",
    } as never);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as never);
    prismaMock.$transaction.mockResolvedValue(undefined as never);

    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
  });

  it("traite paidAgg._sum.amount=null comme 0 (B43 arm1 — ligne 556)", async () => {
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
  });

  it("génère le statut PARTIELLEMENT_PAYE si paiement partiel (B47 arm1 — ligne 571, B49 arm1 — ligne 609)", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(
      buildTransaction({ amount: 100, bankAccountId: ACCOUNT_ID }) as never
    );
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as never);
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
    // newTotal = 0 + 100 = 100 < 500 → PARTIELLEMENT_PAYE, aucune quittance
  });

  it("ne revalide pas le chemin locataire si tenantId est null (B48 arm1 — ligne 604)", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID, totalTTC: 500, invoiceType: "APPEL_LOYER",
      isThirdPartyManaged: false, expectedNetAmount: null, tenantId: null,
    } as never);
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
  });

  it("génère le payment avec reference=undefined si transaction.reference=null (B ligne 571 arm1)", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(
      buildTransaction({ amount: 500, reference: null, bankAccountId: ACCOUNT_ID }) as never
    );
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.payment.create.mockResolvedValue({ id: "cpayment04" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);
    prismaMock.bankReconciliation.create.mockResolvedValue({} as never);
    prismaMock.bankTransaction.update.mockResolvedValue({} as never);
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reference: undefined }) })
    );
  });
});

// ─── reconcileWithLoanLine ────────────────────────────────────────────────────

describe("reconcileWithLoanLine", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockResolvedValue(buildTransaction({ amount: -500 }) as never);
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue({
      id: LOAN_LINE_ID, isPaid: false, dueDate: new Date(), totalPayment: 500,
    } as never);
    prismaMock.$transaction.mockResolvedValue([] as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si transaction introuvable", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(null as never);
    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Transaction introuvable");
  });

  it("erreur si échéance introuvable", async () => {
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue(null as never);
    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Échéance introuvable");
  });

  it("ne charge que les échéances de prêt non payées", async () => {
    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.loanAmortizationLine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: LOAN_LINE_ID,
          isPaid: false,
        }),
      })
    );
  });

  it("refuse de rapprocher une échéance de prêt avec un crédit bancaire", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(buildTransaction({ amount: 500 }) as never);

    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/débitrice/i);
  });

  it("refuse une échéance de prêt si le montant bancaire ne correspond pas", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(buildTransaction({ amount: -420 }) as never);

    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/montant/i);
  });

  it("rapproche avec l'échéance de prêt avec succès", async () => {
    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entity: "LoanAmortizationLine" })
    );
  });

  it("crée une écriture BQUE ventilée pour une échéance de prêt", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(
      buildTransaction({
        amount: -520,
        label: "Echéance prêt avril",
        reference: "PRET-04",
        journalEntryId: null,
      }) as never
    );
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue({
      id: LOAN_LINE_ID,
      dueDate: new Date("2026-04-05"),
      principalPayment: 400,
      interestPayment: 100,
      insurancePayment: 20,
      totalPayment: 520,
    } as never);
    prismaMock.accountingAccount.upsert
      .mockResolvedValueOnce({ id: "account-512", code: "512", label: "Banque", type: "5" } as never)
      .mockResolvedValueOnce({ id: "account-164000", code: "164000", label: "Emprunts", type: "1" } as never)
      .mockResolvedValueOnce({ id: "account-661100", code: "661100", label: "Interets", type: "6" } as never)
      .mockResolvedValueOnce({ id: "account-616000", code: "616000", label: "Assurance", type: "6" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fnOrQueries: ((tx: typeof prismaMock) => Promise<unknown>) | unknown[]) =>
      Array.isArray(fnOrQueries) ? fnOrQueries : fnOrQueries(prismaMock)
    );

    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);

    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "BQUE",
          reference: "PRET-04",
          lines: {
            create: [
              { accountId: "account-164000", debit: 400, credit: 0, label: "Remboursement capital emprunt" },
              { accountId: "account-661100", debit: 100, credit: 0, label: "Intérêts d'emprunt" },
              { accountId: "account-616000", debit: 20, credit: 0, label: "Assurance emprunteur" },
              { accountId: "account-512", debit: 0, credit: 520, label: "Echéance prêt avril" },
            ],
          },
        }),
      })
    );
    expect(prismaMock.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: TX_ID },
      data: { isReconciled: true, journalEntryId: JOURNAL_ID },
    });
  });

  it("rapproche un prélèvement d'intérêts seul sans solder toute l'échéance", async () => {
    const transactionDate = new Date("2026-03-05");
    prismaMock.bankTransaction.findFirst.mockResolvedValue(
      buildTransaction({
        amount: -2716.09,
        label: "00000972856 05/03/26 INTERETS",
        reference: "321",
        transactionDate,
        journalEntryId: null,
      }) as never
    );
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue({
      id: LOAN_LINE_ID,
      dueDate: new Date("2026-03-05"),
      principalPayment: 6509.68,
      interestPayment: 2716.09,
      insurancePayment: 0,
      totalPayment: 9225.77,
      principalPaidAt: null,
      interestPaidAt: null,
      insurancePaidAt: null,
    } as never);
    prismaMock.accountingAccount.upsert
      .mockResolvedValueOnce({ id: "account-512", code: "512", label: "Banque", type: "5" } as never)
      .mockResolvedValueOnce({ id: "account-164000", code: "164000", label: "Emprunts", type: "1" } as never)
      .mockResolvedValueOnce({ id: "account-661100", code: "661100", label: "Interets", type: "6" } as never)
      .mockResolvedValueOnce({ id: "account-616000", code: "616000", label: "Assurance", type: "6" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fnOrQueries: ((tx: typeof prismaMock) => Promise<unknown>) | unknown[]) =>
      Array.isArray(fnOrQueries) ? fnOrQueries : fnOrQueries(prismaMock)
    );

    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);

    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "BQUE",
          lines: {
            create: [
              { accountId: "account-661100", debit: 2716.09, credit: 0, label: "Intérêts d'emprunt" },
              { accountId: "account-512", debit: 0, credit: 2716.09, label: "00000972856 05/03/26 INTERETS" },
            ],
          },
        }),
      })
    );
    expect(prismaMock.loanAmortizationLine.update).toHaveBeenCalledWith({
      where: { id: LOAN_LINE_ID },
      data: {
        interestPaidAt: transactionDate,
        interestBankTransactionId: TX_ID,
        isPaid: false,
        paidAt: null,
      },
    });
  });

  it("solde l'échéance quand le capital est rapproché après les intérêts", async () => {
    const interestPaidAt = new Date("2026-03-05");
    const principalPaidAt = new Date("2026-03-06");
    prismaMock.bankTransaction.findFirst.mockResolvedValue(
      buildTransaction({
        amount: -6509.68,
        label: "00000972856 05/03/26 CAPITAL",
        reference: "318",
        transactionDate: principalPaidAt,
        journalEntryId: null,
      }) as never
    );
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue({
      id: LOAN_LINE_ID,
      dueDate: new Date("2026-03-05"),
      principalPayment: 6509.68,
      interestPayment: 2716.09,
      insurancePayment: 0,
      totalPayment: 9225.77,
      principalPaidAt: null,
      interestPaidAt,
      interestBankTransactionId: "ctransact02",
      insurancePaidAt: null,
    } as never);
    prismaMock.accountingAccount.upsert
      .mockResolvedValueOnce({ id: "account-512", code: "512", label: "Banque", type: "5" } as never)
      .mockResolvedValueOnce({ id: "account-164000", code: "164000", label: "Emprunts", type: "1" } as never)
      .mockResolvedValueOnce({ id: "account-661100", code: "661100", label: "Interets", type: "6" } as never)
      .mockResolvedValueOnce({ id: "account-616000", code: "616000", label: "Assurance", type: "6" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fnOrQueries: ((tx: typeof prismaMock) => Promise<unknown>) | unknown[]) =>
      Array.isArray(fnOrQueries) ? fnOrQueries : fnOrQueries(prismaMock)
    );

    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);

    expect(r.success).toBe(true);
    expect(prismaMock.loanAmortizationLine.update).toHaveBeenCalledWith({
      where: { id: LOAN_LINE_ID },
      data: {
        principalPaidAt,
        principalBankTransactionId: TX_ID,
        isPaid: true,
        paidAt: principalPaidAt,
      },
    });
  });

  it("retourne une erreur si rôle insuffisant pour reconcileWithLoanLine (ForbiddenError ligne 639)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans reconcileWithLoanLine (lignes 640-641)", async () => {
    prismaMock.bankTransaction.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors du rapprochement" });
  });
});

// ─── generateJournalEntry ─────────────────────────────────────────────────────

const JOURNAL_ID = "cjournal01";
const ACCOUNT_LINE_ID = "caccline01";

describe("generateJournalEntry", () => {
  const buildAccountRecord = (code: string) => ({
    id: ACCOUNT_LINE_ID, societyId: SOCIETY_ID, code, label: "Compte", type: "5",
  });

  beforeEach(() => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      ...buildTransaction(),
      amount: 500,
      reconciliations: [],
      bankAccount: { id: ACCOUNT_ID, societyId: SOCIETY_ID },
    } as never);
    prismaMock.accountingAccount.upsert.mockResolvedValue(buildAccountRecord("512") as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: JOURNAL_ID } as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si transaction introuvable", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue(null as never);
    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("introuvable");
  });

  it("génère une écriture comptable pour un encaissement", async () => {
    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(JOURNAL_ID);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ journalType: "BQUE" }),
      })
    );
    expect(prismaMock.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: TX_ID },
      data: { journalEntryId: JOURNAL_ID },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/comptabilite");
    expect(revalidatePath).toHaveBeenCalledWith(`/banque/${ACCOUNT_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/banque/${ACCOUNT_ID}/rapprochement`);
  });

  it("retourne l'écriture bancaire déjà liée sans créer de doublon", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      ...buildTransaction(),
      amount: 500,
      journalEntryId: JOURNAL_ID,
      reconciliations: [],
      bankAccount: { id: ACCOUNT_ID, societyId: SOCIETY_ID },
    } as never);

    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);

    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(JOURNAL_ID);
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it("refuse de générer une écriture bancaire pour un montant nul", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      ...buildTransaction(),
      amount: 0,
      reconciliations: [],
      bankAccount: { id: ACCOUNT_ID, societyId: SOCIETY_ID },
    } as never);

    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/montant nul/i);
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it("génère une écriture pour un décaissement (montant négatif)", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      ...buildTransaction(),
      amount: -300,
      reconciliations: [],
      bankAccount: { id: ACCOUNT_ID, societyId: SOCIETY_ID },
    } as never);

    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);
    expect(r.success).toBe(true);
  });

  it("utilise le compte 627000 pour une transaction catégorisée frais bancaires", async () => {
    prismaMock.accountingAccount.upsert
      .mockResolvedValueOnce({ id: "account-512", code: "512", label: "Banque", type: "5" } as never)
      .mockResolvedValueOnce({ id: "account-411", code: "411", label: "Clients", type: "4" } as never)
      .mockResolvedValueOnce({ id: "account-658", code: "658", label: "Charges diverses", type: "6" } as never)
      .mockResolvedValueOnce({ id: "account-622", code: "622", label: "Honoraires", type: "6" } as never)
      .mockResolvedValueOnce({ id: "account-627000", code: "627000", label: "Frais bancaires", type: "6" } as never);
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      ...buildTransaction(),
      amount: -25,
      category: "frais_bancaires",
      reconciliations: [],
      bankAccount: { id: ACCOUNT_ID, societyId: SOCIETY_ID },
    } as never);

    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);

    expect(r.success).toBe(true);
    expect(prismaMock.accountingAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId_code: { societyId: SOCIETY_ID, code: "627000" } },
      })
    );
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                accountId: "account-627000",
                debit: 25,
                credit: 0,
              }),
              expect.objectContaining({
                accountId: "account-512",
                debit: 0,
                credit: 25,
              }),
            ]),
          },
        }),
      })
    );
  });

  it("génère une écriture à 3 lignes pour gestion tiers (lignes 375, 388-390)", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      ...buildTransaction(),
      amount: 460,
      label: "Virement net",
      reconciliations: [{
        payment: {
          invoice: { isThirdPartyManaged: true, managementFeeTTC: 40 },
        },
      }],
      bankAccount: { id: ACCOUNT_ID, societyId: SOCIETY_ID },
    } as never);

    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ journalType: "BQUE" }),
      })
    );
  });

  it("génère une écriture sans référence quand reference=null (B32 arm1 — ligne 432)", async () => {
    prismaMock.bankTransaction.findFirst.mockResolvedValue({
      ...buildTransaction(),
      amount: 500,
      reference: null,
      reconciliations: [],
      bankAccount: { id: ACCOUNT_ID, societyId: SOCIETY_ID },
    } as never);
    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reference: undefined }),
      })
    );
  });

  it("retourne une erreur si rôle insuffisant pour generateJournalEntry (ligne 433)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans generateJournalEntry (lignes 434-435)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockRejectedValue(new Error("DB error"));
    const r = await generateJournalEntry(SOCIETY_ID, TX_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de la génération de l'écriture" });
  });
});
