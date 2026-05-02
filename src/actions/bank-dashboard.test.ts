import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "@/generated/prisma/client";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";

import { getBankOperationsDashboard } from "./bank-dashboard";

const SOCIETY_ID = "society-1";

describe("getBankOperationsDashboard", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.bankAccount.findMany.mockResolvedValue([
      {
        id: "bank-1",
        bankName: "BNP Paribas",
        accountName: "Compte principal",
        currentBalance: 42000,
        isActive: true,
        lastSyncAt: new Date("2026-05-01T06:00:00.000Z"),
        powensAccountId: "powens-account-1",
        qontoAccountId: null,
        connection: {
          id: "connection-1",
          provider: "POWENS",
          institutionName: "BNP Paribas",
          status: "active",
          expiresAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        _count: { transactions: 4 },
      },
      {
        id: "bank-2",
        bankName: "Qonto",
        accountName: "Compte pro",
        currentBalance: 8000,
        isActive: true,
        lastSyncAt: new Date("2026-04-29T06:00:00.000Z"),
        powensAccountId: null,
        qontoAccountId: "qonto-account-1",
        connection: {
          id: "connection-2",
          provider: "QONTO",
          institutionName: "Qonto",
          status: "error",
          expiresAt: null,
        },
        _count: { transactions: 2 },
      },
      {
        id: "bank-3",
        bankName: "Banque manuelle",
        accountName: "Import CSV",
        currentBalance: 1000,
        isActive: true,
        lastSyncAt: null,
        powensAccountId: null,
        qontoAccountId: null,
        connection: null,
        _count: { transactions: 1 },
      },
    ] as never);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        bankAccountId: "bank-1",
        amount: 1200,
        category: "loyers",
        isReconciled: true,
        journalEntryId: "journal-1",
        transactionDate: new Date("2026-05-01"),
        bankAccount: {
          id: "bank-1",
          bankName: "BNP Paribas",
          accountName: "Compte principal",
          powensAccountId: "powens-account-1",
          qontoAccountId: null,
          connection: {
            id: "connection-1",
            provider: "POWENS",
            institutionName: "BNP Paribas",
            status: "active",
          },
        },
      },
      {
        id: "tx-2",
        bankAccountId: "bank-1",
        amount: -450,
        category: null,
        isReconciled: false,
        journalEntryId: null,
        transactionDate: new Date("2026-05-02"),
        bankAccount: {
          id: "bank-1",
          bankName: "BNP Paribas",
          accountName: "Compte principal",
          powensAccountId: "powens-account-1",
          qontoAccountId: null,
          connection: {
            id: "connection-1",
            provider: "POWENS",
            institutionName: "BNP Paribas",
            status: "active",
          },
        },
      },
      {
        id: "tx-3",
        bankAccountId: "bank-2",
        amount: -900,
        category: "travaux",
        isReconciled: false,
        journalEntryId: null,
        transactionDate: new Date("2026-05-02"),
        bankAccount: {
          id: "bank-2",
          bankName: "Qonto",
          accountName: "Compte pro",
          powensAccountId: null,
          qontoAccountId: "qonto-account-1",
          connection: {
            id: "connection-2",
            provider: "QONTO",
            institutionName: "Qonto",
            status: "error",
          },
        },
      },
    ] as never);
    prismaMock.supplierInvoice.findMany.mockResolvedValue([
      {
        id: "supplier-1",
        supplierName: "EDF",
        amountTTC: 450,
        dueDate: new Date("2026-05-05"),
        status: "VALIDATED",
        paymentStatus: null,
        paymentMethod: null,
        paymentExecutedAt: null,
        bankAccountId: "bank-1",
        bankJournalEntryId: null,
      },
      {
        id: "supplier-2",
        supplierName: "Syndic ABC",
        amountTTC: 900,
        dueDate: new Date("2026-05-08"),
        status: "PAID",
        paymentStatus: "CONFIRMED",
        paymentMethod: "MANUAL",
        paymentExecutedAt: new Date("2026-05-02"),
        bankAccountId: "bank-2",
        bankJournalEntryId: null,
      },
    ] as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([
      {
        id: "entry-1",
        journalType: "BQUE",
        entryDate: new Date("2026-05-01"),
        status: "BROUILLON",
        isValidated: false,
        lines: [
          { debit: 1200, credit: 0, account: { code: "512", label: "Banque" } },
          { debit: 0, credit: 1200, account: { code: "411", label: "Clients" } },
        ],
      },
      {
        id: "entry-2",
        journalType: "BQUE",
        entryDate: new Date("2026-05-02"),
        status: "BROUILLON",
        isValidated: false,
        lines: [
          { debit: 0, credit: 140, account: { code: "512", label: "Banque" } },
          { debit: 140, credit: 0, account: { code: "627", label: "Frais" } },
        ],
      },
    ] as never);
  });

  it("retourne null si l'utilisateur n'a pas acces a la societe", async () => {
    mockUnauthenticated();

    const dashboard = await getBankOperationsDashboard(SOCIETY_ID);

    expect(dashboard).toBeNull();
    expect(prismaMock.bankAccount.findMany).not.toHaveBeenCalled();
  });

  it("agrège les KPI opérationnels, partenaires bancaires et files d'action", async () => {
    const dashboard = await getBankOperationsDashboard(SOCIETY_ID, {
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(dashboard).not.toBeNull();
    expect(dashboard?.kpis.totalBalance).toBe(51000);
    expect(dashboard?.kpis.periodCredits).toBe(1200);
    expect(dashboard?.kpis.periodDebits).toBe(-1350);
    expect(dashboard?.kpis.periodNet).toBe(-150);
    expect(dashboard?.actionQueues.unreconciledTransactions).toBe(2);
    expect(dashboard?.actionQueues.uncategorizedTransactions).toBe(1);
    expect(dashboard?.actionQueues.missingBankJournalEntries).toBe(2);
    expect(dashboard?.actionQueues.supplierInvoicesToPay).toBe(1);
    expect(dashboard?.actionQueues.supplierPaymentsToReconcile).toBe(1);
    expect(dashboard?.actionQueues.bankingConnectionsAttention).toBe(1);
    expect(dashboard?.supplierPaymentControl).toEqual({
      toPayAmount: 450,
      toPayCount: 1,
      overdueAmount: 0,
      overdueCount: 0,
      toReconcileAmount: 900,
      toReconcileCount: 1,
    });
    expect(dashboard?.partnerFlows).toEqual([
      expect.objectContaining({
        provider: "POWENS",
        institutionName: "BNP Paribas",
        accountCount: 1,
        transactionCount: 2,
        periodCredits: 1200,
        periodDebits: -450,
        unreconciledCount: 1,
        missingJournalEntryCount: 1,
        supplierToPayAmount: 450,
        supplierToReconcileAmount: 0,
        status: "active",
      }),
      expect.objectContaining({
        provider: "QONTO",
        institutionName: "Qonto",
        accountCount: 1,
        transactionCount: 1,
        periodDebits: -900,
        supplierToPayAmount: 0,
        supplierToReconcileAmount: 900,
        status: "error",
      }),
      expect.objectContaining({
        provider: "MANUAL",
        institutionName: "Comptes manuels",
        accountCount: 1,
        transactionCount: 0,
      }),
    ]);
  });

  it("calcule le controle banque-compta et les anomalies actionnables", async () => {
    const dashboard = await getBankOperationsDashboard(SOCIETY_ID);

    expect(dashboard?.accountingControl.bankAccountCount).toBe(3);
    expect(dashboard?.accountingControl.bankJournalEntriesCount).toBe(2);
    expect(dashboard?.accountingControl.accountingBankBalance).toBe(1060);
    expect(dashboard?.accountingControl.bankToAccountingDelta).toBe(49940);
    expect(dashboard?.accountingControl.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_BQUE",
          count: 2,
        }),
        expect.objectContaining({
          code: "SUPPLIER_PAYMENT_TO_RECONCILE",
          count: 1,
        }),
        expect.objectContaining({
          code: "BANK_ACCOUNTING_DELTA",
        }),
      ])
    );
  });
});
