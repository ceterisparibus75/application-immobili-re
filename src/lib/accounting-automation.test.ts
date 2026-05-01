import { describe, expect, it } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import {
  createCustomerInvoiceJournalEntry,
  createCustomerPaymentJournalEntry,
} from "./accounting-automation";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const INVOICE_ID = "clh3x2z4k0001qh8g7z1y2v3t";
const PAYMENT_ID = "clh3x2z4k0002qh8g7z1y2v3t";

describe("accounting automation", () => {
  it("crée une écriture de vente équilibrée pour une facture client", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "FAC-2026-0001",
      invoiceType: "APPEL_LOYER",
      issueDate: new Date("2026-01-01"),
      totalTTC: 1200,
      totalVAT: 200,
      tenant: {
        entityType: "PERSONNE_PHYSIQUE",
        firstName: "Jean",
        lastName: "Dupont",
        companyName: null,
      },
      lines: [
        {
          label: "Loyer janvier",
          totalHT: 1000,
          totalVAT: 200,
          accountingAccountCode: null,
        },
      ],
    } as never);
    prismaMock.accountingAccount.findFirst
      .mockResolvedValueOnce({ id: "acc-411", code: "411000", label: "Locataires" } as never)
      .mockResolvedValueOnce({ id: "acc-4457", code: "445710", label: "TVA collectée" } as never)
      .mockResolvedValueOnce({ id: "acc-706", code: "706100", label: "Loyers" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: "entry-sale" } as never);

    const result = await createCustomerInvoiceJournalEntry(
      prismaMock as never,
      SOCIETY_ID,
      INVOICE_ID
    );

    expect(result).toBe("entry-sale");
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "VT",
          piece: "FAC-2026-0001",
          reference: `invoice:${INVOICE_ID}:validation`,
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({ accountId: "acc-411", debit: 1200, credit: 0 }),
              expect.objectContaining({ accountId: "acc-706", debit: 0, credit: 1000 }),
              expect.objectContaining({ accountId: "acc-4457", debit: 0, credit: 200 }),
            ]),
          },
        }),
        select: { id: true },
      })
    );
  });

  it("crée une écriture bancaire pour un paiement client", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.payment.findFirst.mockResolvedValue({
      id: PAYMENT_ID,
      amount: 1200,
      paidAt: new Date("2026-01-05"),
      method: "virement",
      reference: "VIR-001",
      invoice: {
        invoiceNumber: "FAC-2026-0001",
        tenant: {
          entityType: "PERSONNE_PHYSIQUE",
          firstName: "Jean",
          lastName: "Dupont",
          companyName: null,
        },
      },
    } as never);
    prismaMock.accountingAccount.findFirst
      .mockResolvedValueOnce({ id: "acc-411", code: "411000", label: "Locataires" } as never)
      .mockResolvedValueOnce({ id: "acc-512", code: "512000", label: "Banque" } as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: "entry-bank" } as never);

    const result = await createCustomerPaymentJournalEntry(
      prismaMock as never,
      SOCIETY_ID,
      PAYMENT_ID
    );

    expect(result).toBe("entry-bank");
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "BQUE",
          piece: "VIR-001",
          reference: `payment:${PAYMENT_ID}`,
          lines: {
            create: [
              expect.objectContaining({ accountId: "acc-512", debit: 1200, credit: 0 }),
              expect.objectContaining({ accountId: "acc-411", debit: 0, credit: 1200 }),
            ],
          },
        }),
      })
    );
  });

  it("ne duplique pas une écriture déjà créée", async () => {
    prismaMock.journalEntry.findFirst.mockResolvedValue({ id: "existing-entry" } as never);

    const result = await createCustomerPaymentJournalEntry(
      prismaMock as never,
      SOCIETY_ID,
      PAYMENT_ID
    );

    expect(result).toBe("existing-entry");
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });
});
