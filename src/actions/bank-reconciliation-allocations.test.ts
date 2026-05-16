import { describe, it, expect, vi, beforeEach } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { reconcileTransactionWithAllocations } from "./bank-reconciliation-mutations";

const SOCIETY_ID = "society-1";
const TX_ID = "ctxalloc01";
const INVOICE_A = "cinvoicea1";
const INVOICE_B = "cinvoiceb2";
const TENANT_ID = "ctenant001";

function mockTransaction(amount: number, existingAllocations: number[] = []) {
  prismaMock.bankTransaction.findFirst.mockResolvedValue({
    id: TX_ID,
    bankAccountId: "cbankacc01",
    amount,
    transactionDate: new Date("2026-05-06"),
    reference: "VIR-MEUTH-001",
    reconciliations: existingAllocations.map((a, i) => ({ id: `r${i}`, amount: a })),
  } as never);
}

function mockInvoices(invoices: Array<{ id: string; tenantId: string; totalTTC: number }>) {
  prismaMock.invoice.findMany.mockResolvedValue(
    invoices.map((i) => ({
      id: i.id,
      tenantId: i.tenantId,
      leaseId: "clease0001",
      totalTTC: i.totalTTC,
      invoiceType: "APPEL_LOYER",
      isThirdPartyManaged: false,
      expectedNetAmount: null,
    })) as never,
  );
}

function mockTxScope() {
  const created = {
    paymentIds: [] as string[],
    balanceAdjustmentId: null as string | null,
  };
  const txMock = {
    payment: {
      create: vi.fn().mockImplementation((args) => {
        const id = `cpay${created.paymentIds.length + 1}`;
        created.paymentIds.push(id);
        return Promise.resolve({ id, ...args.data });
      }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 9999 } }),
    },
    bankReconciliation: {
      create: vi.fn().mockResolvedValue({ id: "crec1" }),
    },
    invoice: { update: vi.fn().mockResolvedValue({}) },
    tenantBalanceAdjustment: {
      create: vi.fn().mockImplementation((args) => {
        const id = "cadj0001";
        created.balanceAdjustmentId = id;
        return Promise.resolve({ id, ...args.data });
      }),
    },
    bankTransaction: { update: vi.fn().mockResolvedValue({}) },
  };
  prismaMock.$transaction.mockImplementation(async (fn) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fn as any)(txMock as any),
  );
  return { txMock, created };
}

describe("reconcileTransactionWithAllocations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejette si non authentifié", async () => {
    mockUnauthenticated();
    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 100 },
    ]);
    expect(r.success).toBe(false);
  });

  it("rejette si aucune allocation", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, []);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Aucune facture/);
  });

  it("rejette une facture dupliquée", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 600 },
      { invoiceId: INVOICE_A, amount: 600 },
    ]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/plusieurs fois/);
  });

  it("rejette un montant <= 0", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 0 },
    ]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/strictement positifs/);
  });

  it("rejette si la somme dépasse le virement", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(1000);
    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 600 },
      { invoiceId: INVOICE_B, amount: 500 },
    ]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/dépasse/);
  });

  it("rejette si factures de locataires différents", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(2000);
    mockInvoices([
      { id: INVOICE_A, tenantId: "tenant-1", totalTTC: 1000 },
      { id: INVOICE_B, tenantId: "tenant-2", totalTTC: 1000 },
    ]);
    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 1000 },
      { invoiceId: INVOICE_B, amount: 1000 },
    ]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/même locataire/i);
  });

  it("cas Meuth : virement 2400 → 2 factures 1200, somme exacte", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(2400);
    mockInvoices([
      { id: INVOICE_A, tenantId: TENANT_ID, totalTTC: 1200 },
      { id: INVOICE_B, tenantId: TENANT_ID, totalTTC: 1200 },
    ]);
    const { txMock } = mockTxScope();

    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 1200 },
      { invoiceId: INVOICE_B, amount: 1200 },
    ]);

    expect(r.success).toBe(true);
    expect(txMock.payment.create).toHaveBeenCalledTimes(2);
    expect(txMock.bankReconciliation.create).toHaveBeenCalledTimes(2);
    expect(txMock.tenantBalanceAdjustment.create).not.toHaveBeenCalled();
    expect(txMock.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: TX_ID },
      data: { isReconciled: true },
    });
  });

  it("trop-perçu (virement 3000 pour 2x1200) → avoir locataire créé", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(3000);
    mockInvoices([
      { id: INVOICE_A, tenantId: TENANT_ID, totalTTC: 1200 },
      { id: INVOICE_B, tenantId: TENANT_ID, totalTTC: 1200 },
    ]);
    const { txMock } = mockTxScope();

    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 1200 },
      { invoiceId: INVOICE_B, amount: 1200 },
    ]);

    expect(r.success).toBe(true);
    expect(txMock.tenantBalanceAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          amount: -600,
          source: "BANK_RECONCILIATION",
          reconciledBankTransactionId: TX_ID,
        }),
      }),
    );
    expect(txMock.bankTransaction.update).toHaveBeenCalledWith({
      where: { id: TX_ID },
      data: { isReconciled: true },
    });
  });

  it("désactive le trop-perçu si creditExcessToTenant = false", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(3000);
    mockInvoices([
      { id: INVOICE_A, tenantId: TENANT_ID, totalTTC: 1200 },
    ]);
    const { txMock } = mockTxScope();

    const r = await reconcileTransactionWithAllocations(
      SOCIETY_ID,
      TX_ID,
      [{ invoiceId: INVOICE_A, amount: 1200 }],
      { creditExcessToTenant: false },
    );

    expect(r.success).toBe(true);
    expect(txMock.tenantBalanceAdjustment.create).not.toHaveBeenCalled();
    // Pas de close de la transaction (PARTIAL : 1800 restants)
    expect(txMock.bankTransaction.update).not.toHaveBeenCalled();
  });

  it("paiement partiel (sans crédit) laisse la transaction non-fermée", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(2400);
    mockInvoices([
      { id: INVOICE_A, tenantId: TENANT_ID, totalTTC: 1200 },
    ]);
    const { txMock } = mockTxScope();

    const r = await reconcileTransactionWithAllocations(
      SOCIETY_ID,
      TX_ID,
      [{ invoiceId: INVOICE_A, amount: 1200 }],
      { creditExcessToTenant: false },
    );

    expect(r.success).toBe(true);
    expect(txMock.payment.create).toHaveBeenCalledTimes(1);
    expect(txMock.bankTransaction.update).not.toHaveBeenCalled();
  });

  it("rejette une transaction débitrice (virement sortant)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(-500);
    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 500 },
    ]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/cr[ée]ditrice/i);
  });

  it("compte les ventilations déjà existantes (ajout sur transaction partiellement rapprochée)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(2400, [1200]); // 1200 déjà ventilé
    mockInvoices([
      { id: INVOICE_A, tenantId: TENANT_ID, totalTTC: 1200 },
    ]);
    mockTxScope();

    // Tente d'ajouter 1500 alors que 1200 déjà alloué → dépasse 2400
    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 1500 },
    ]);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/dépasse/);
  });

  it("rejette une facture qui n'appartient pas à la société", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    mockTransaction(1200);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);

    const r = await reconcileTransactionWithAllocations(SOCIETY_ID, TX_ID, [
      { invoiceId: INVOICE_A, amount: 1200 },
    ]);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/introuvables/);
  });
});
