import type { Prisma } from "@/generated/prisma/client";
import { resolveOpenFiscalYearIdForDate } from "@/lib/accounting-period";

type AccountingAccountRef = {
  id: string;
  code: string;
  label: string;
};

type AccountingClient = Pick<
  Prisma.TransactionClient,
  "accountingAccount" | "fiscalYear" | "invoice" | "journalEntry" | "payment"
>;

type JournalLineInput = {
  accountId: string;
  debit: number;
  credit: number;
  label: string;
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

async function ensureAccount(
  tx: AccountingClient,
  societyId: string,
  candidates: string[],
  fallback: { code: string; label: string; type: string }
): Promise<AccountingAccountRef> {
  const existing = await tx.accountingAccount.findFirst({
    where: {
      societyId,
      isActive: true,
      OR: candidates.map((code) => ({ code: { startsWith: code } })),
    },
    select: { id: true, code: true, label: true },
    orderBy: { code: "asc" },
  });
  if (existing) return existing;

  return tx.accountingAccount.upsert({
    where: { societyId_code: { societyId, code: fallback.code } },
    update: { isActive: true },
    create: {
      societyId,
      code: fallback.code,
      label: fallback.label,
      type: fallback.type,
      isActive: true,
    },
    select: { id: true, code: true, label: true },
  });
}

async function resolveRevenueAccount(
  tx: AccountingClient,
  societyId: string,
  accountingAccountCode: string | null
): Promise<AccountingAccountRef> {
  if (accountingAccountCode) {
    const account = await tx.accountingAccount.findUnique({
      where: { societyId_code: { societyId, code: accountingAccountCode } },
      select: { id: true, code: true, label: true },
    });
    if (account) return account;
  }

  return ensureAccount(tx, societyId, ["706", "70"], {
    code: "706100",
    label: "Loyers - Locaux d'habitation",
    type: "7",
  });
}

function pushGroupedLine(lines: JournalLineInput[], next: JournalLineInput): void {
  const rounded = {
    ...next,
    debit: roundCents(next.debit),
    credit: roundCents(next.credit),
  };
  if (rounded.debit === 0 && rounded.credit === 0) return;

  const existing = lines.find(
    (line) => line.accountId === rounded.accountId && line.label === rounded.label
  );
  if (!existing) {
    lines.push(rounded);
    return;
  }

  existing.debit = roundCents(existing.debit + rounded.debit);
  existing.credit = roundCents(existing.credit + rounded.credit);
}

export async function createCustomerInvoiceJournalEntry(
  tx: AccountingClient,
  societyId: string,
  invoiceId: string
): Promise<string | null> {
  const reference = `invoice:${invoiceId}:validation`;
  const existing = await tx.journalEntry.findFirst({
    where: { societyId, reference },
    select: { id: true },
  });
  if (existing) return existing.id;

  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, societyId },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      issueDate: true,
      totalTTC: true,
      totalVAT: true,
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
          entityType: true,
        },
      },
      lines: {
        select: {
          label: true,
          totalHT: true,
          totalVAT: true,
          accountingAccountCode: true,
        },
      },
    },
  });
  if (!invoice || !invoice.invoiceNumber) return null;

  const tenantName =
    invoice.tenant.entityType === "PERSONNE_MORALE"
      ? invoice.tenant.companyName ?? "Locataire"
      : `${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim() || "Locataire";
  const piece = invoice.invoiceNumber;
  const isCreditNote = invoice.invoiceType === "AVOIR" || invoice.totalTTC < 0;
  const totalTTC = Math.abs(roundCents(invoice.totalTTC));
  const totalVAT = Math.abs(roundCents(invoice.totalVAT));

  const account411 = await ensureAccount(tx, societyId, ["411"], {
    code: "411000",
    label: "Locataires",
    type: "4",
  });
  const accountVat = totalVAT > 0
    ? await ensureAccount(tx, societyId, ["4457"], {
        code: "445710",
        label: "TVA collectee",
        type: "4",
      })
    : null;

  const lines: JournalLineInput[] = [];

  pushGroupedLine(lines, {
    accountId: account411.id,
    debit: isCreditNote ? 0 : totalTTC,
    credit: isCreditNote ? totalTTC : 0,
    label: tenantName,
  });

  for (const invoiceLine of invoice.lines) {
    const revenueAccount = await resolveRevenueAccount(
      tx,
      societyId,
      invoiceLine.accountingAccountCode
    );
    const amountHT = Math.abs(roundCents(invoiceLine.totalHT));
    pushGroupedLine(lines, {
      accountId: revenueAccount.id,
      debit: isCreditNote ? amountHT : 0,
      credit: isCreditNote ? 0 : amountHT,
      label: invoiceLine.label,
    });
  }

  if (accountVat && totalVAT > 0) {
    pushGroupedLine(lines, {
      accountId: accountVat.id,
      debit: isCreditNote ? totalVAT : 0,
      credit: isCreditNote ? 0 : totalVAT,
      label: "TVA collectee",
    });
  }

  const debit = roundCents(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = roundCents(lines.reduce((sum, line) => sum + line.credit, 0));
  if (lines.length < 2 || Math.abs(debit - credit) > 0.01) return null;

  const journalType: Prisma.JournalEntryCreateInput["journalType"] = "VT";
  const label = `${isCreditNote ? "Avoir" : "Facture"} ${piece} - ${tenantName}`;
  const fiscalYearId = await resolveOpenFiscalYearIdForDate(tx, societyId, invoice.issueDate);
  const entry = await tx.journalEntry.create({
    data: {
      societyId,
      fiscalYearId,
      journalType,
      entryDate: invoice.issueDate,
      piece,
      label,
      reference,
      status: "BROUILLON",
      lines: { create: lines },
    },
    select: { id: true },
  });

  return entry.id;
}

export async function createCustomerPaymentJournalEntry(
  tx: AccountingClient,
  societyId: string,
  paymentId: string
): Promise<string | null> {
  const reference = `payment:${paymentId}`;
  const existing = await tx.journalEntry.findFirst({
    where: { societyId, reference },
    select: { id: true },
  });
  if (existing) return existing.id;

  const payment = await tx.payment.findFirst({
    where: { id: paymentId, invoice: { societyId } },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      method: true,
      reference: true,
      invoice: {
        select: {
          invoiceNumber: true,
          tenant: {
            select: {
              firstName: true,
              lastName: true,
              companyName: true,
              entityType: true,
            },
          },
        },
      },
    },
  });
  if (!payment) return null;

  const amount = roundCents(payment.amount);
  if (amount <= 0) return null;

  const tenantName =
    payment.invoice.tenant.entityType === "PERSONNE_MORALE"
      ? payment.invoice.tenant.companyName ?? "Locataire"
      : `${payment.invoice.tenant.firstName ?? ""} ${payment.invoice.tenant.lastName ?? ""}`.trim() || "Locataire";
  const account411 = await ensureAccount(tx, societyId, ["411"], {
    code: "411000",
    label: "Locataires",
    type: "4",
  });
  const account512 = await ensureAccount(tx, societyId, ["512"], {
    code: "512000",
    label: "Banques",
    type: "5",
  });

  const piece = payment.reference ?? payment.invoice.invoiceNumber ?? undefined;
  const method = payment.method ? ` (${payment.method})` : "";
  const fiscalYearId = await resolveOpenFiscalYearIdForDate(tx, societyId, payment.paidAt);
  const entry = await tx.journalEntry.create({
    data: {
      societyId,
      fiscalYearId,
      journalType: "BQUE",
      entryDate: payment.paidAt,
      piece,
      label: `Reglement ${payment.invoice.invoiceNumber ?? ""} - ${tenantName}${method}`.trim(),
      reference,
      status: "BROUILLON",
      lines: {
        create: [
          { accountId: account512.id, debit: amount, credit: 0, label: tenantName },
          { accountId: account411.id, debit: 0, credit: amount, label: tenantName },
        ],
      },
    },
    select: { id: true },
  });

  return entry.id;
}
