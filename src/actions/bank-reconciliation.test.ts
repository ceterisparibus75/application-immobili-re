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
