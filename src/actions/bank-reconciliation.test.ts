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
  amount: -500,
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
    expect(r.error).toBe("Transaction introuvable");
  });

  it("erreur si paiement introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.payment.findFirst.mockResolvedValue(null);
    const r = await manualReconcile(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Paiement introuvable");
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
});

// ─── unreconcile ──────────────────────────────────────────────────────────────

describe("unreconcile", () => {
  const buildReconciliation = () => ({
    id: RECONCIL_ID,
    transactionId: TX_ID,
    paymentId: PAYMENT_ID,
    transaction: { bankAccountId: ACCOUNT_ID },
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
      { id: TX_ID, isReconciled: false, amount: -500 },
    ] as never);
    const r = await getUnreconciledTransactions(SOCIETY_ID, ACCOUNT_ID);
    expect(r).toHaveLength(1);
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
      { id: RECONCIL_ID, isValidated: true },
    ] as never);
    const r = await getReconciledItems(SOCIETY_ID, ACCOUNT_ID);
    expect(r).toHaveLength(1);
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
      { id: "cinvoice01", status: "VALIDEE", invoiceType: "APPEL_LOYER" },
    ] as never);
    const r = await getPendingInvoices(SOCIETY_ID);
    expect(r).toHaveLength(1);
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

  it("retourne les échéances de prêt non payées", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.loanAmortizationLine.findMany.mockResolvedValue([
      { id: "cloanline01", isPaid: false, dueDate: new Date() },
    ] as never);
    const r = await getUpcomingLoanLines(SOCIETY_ID);
    expect(r).toHaveLength(1);
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

  it("rapproche avec succès", async () => {
    const r = await reconcileWithInvoice(SOCIETY_ID, TX_ID, INVOICE_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE", entity: "BankReconciliation" })
    );
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
});

// ─── reconcileWithLoanLine ────────────────────────────────────────────────────

describe("reconcileWithLoanLine", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findFirst.mockResolvedValue(buildTransaction() as never);
    prismaMock.loanAmortizationLine.findFirst.mockResolvedValue({
      id: LOAN_LINE_ID, isPaid: false, dueDate: new Date(),
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

  it("rapproche avec l'échéance de prêt avec succès", async () => {
    const r = await reconcileWithLoanLine(SOCIETY_ID, TX_ID, LOAN_LINE_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entity: "LoanAmortizationLine" })
    );
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
        data: expect.objectContaining({ journalType: "BANQUE" }),
      })
    );
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
});
