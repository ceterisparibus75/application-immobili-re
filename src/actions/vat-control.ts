"use server";

import type { ActionResult } from "@/actions/society";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";

export type VatAccountRow = {
  accountId: string;
  code: string;
  label: string;
  debit: number;
  credit: number;
  balance: number;
  kind: "COLLECTED" | "DEDUCTIBLE" | "OTHER";
};

export type VatControlResult = {
  accounting: {
    collected: number;
    deductible: number;
    netDue: number;
    accounts: VatAccountRow[];
  };
  business: {
    customerVat: number;
    supplierVat: number;
    netDue: number;
  };
  discrepancies: {
    collected: number;
    deductible: number;
    netDue: number;
  };
};

export type VatLiquidationResult = {
  id: string;
  alreadyExists: boolean;
};

type VatAccountingClient = Pick<Prisma.TransactionClient, "accountingAccount" | "journalEntry">;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function getVatKind(code: string): VatAccountRow["kind"] {
  if (code.startsWith("4457")) return "COLLECTED";
  if (code.startsWith("4456")) return "DEDUCTIBLE";
  return "OTHER";
}

function buildVatPeriodReference(filters: { dateFrom?: string; dateTo?: string }): string {
  return `vat-liquidation:${filters.dateFrom ?? "start"}:${filters.dateTo ?? "end"}`;
}

async function ensureVatAccount(
  tx: VatAccountingClient,
  societyId: string,
  code: string,
  label: string
) {
  return tx.accountingAccount.upsert({
    where: { societyId_code: { societyId, code } },
    update: { isActive: true },
    create: {
      societyId,
      code,
      label,
      type: "4",
      isActive: true,
    },
    select: { id: true },
  });
}

export async function getVatControl(
  societyId: string,
  filters: { dateFrom?: string; dateTo?: string } = {}
): Promise<ActionResult<VatControlResult>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const entryDate: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          }
        : undefined;
    const invoiceDateFilter: Prisma.DateTimeFilter | undefined = entryDate;

    const [vatLines, customerInvoices, supplierVat] = await Promise.all([
      prisma.journalEntryLine.findMany({
        where: {
          account: {
            societyId,
            OR: [
              { code: { startsWith: "4457" } },
              { code: { startsWith: "4456" } },
            ],
          },
          journalEntry: {
            ...(entryDate ? { entryDate } : {}),
            NOT: { reference: { startsWith: "vat-liquidation:" } },
          },
        },
        select: {
          debit: true,
          credit: true,
          account: { select: { id: true, code: true, label: true } },
        },
      }),
      prisma.invoice.findMany({
        where: {
          societyId,
          status: { notIn: ["BROUILLON", "ANNULEE"] },
          ...(invoiceDateFilter ? { issueDate: invoiceDateFilter } : {}),
        },
        select: { totalVAT: true },
      }),
      prisma.supplierInvoice.aggregate({
        where: {
          societyId,
          status: { in: ["VALIDATED", "PAID"] },
          amountVAT: { not: null },
          ...(invoiceDateFilter ? { invoiceDate: invoiceDateFilter } : {}),
        },
        _sum: { amountVAT: true },
      }),
    ]);

    const accountMap = new Map<string, VatAccountRow>();
    for (const line of vatLines) {
      const key = line.account.id;
      const existing = accountMap.get(key);
      if (existing) {
        existing.debit = roundCents(existing.debit + line.debit);
        existing.credit = roundCents(existing.credit + line.credit);
        existing.balance = roundCents(existing.credit - existing.debit);
        continue;
      }

      accountMap.set(key, {
        accountId: line.account.id,
        code: line.account.code,
        label: line.account.label,
        debit: roundCents(line.debit),
        credit: roundCents(line.credit),
        balance: roundCents(line.credit - line.debit),
        kind: getVatKind(line.account.code),
      });
    }

    const accounts = [...accountMap.values()].sort((a, b) => a.code.localeCompare(b.code));
    const collected = roundCents(
      accounts
        .filter((account) => account.kind === "COLLECTED")
        .reduce((sum, account) => sum + account.balance, 0)
    );
    const deductible = roundCents(
      accounts
        .filter((account) => account.kind === "DEDUCTIBLE")
        .reduce((sum, account) => sum - account.balance, 0)
    );
    const customerVat = roundCents(
      customerInvoices.reduce((sum, invoice) => sum + invoice.totalVAT, 0)
    );
    const supplierVatAmount = roundCents(supplierVat._sum.amountVAT ?? 0);

    const accountingNetDue = roundCents(collected - deductible);
    const businessNetDue = roundCents(customerVat - supplierVatAmount);

    return {
      success: true,
      data: {
        accounting: {
          collected,
          deductible,
          netDue: accountingNetDue,
          accounts,
        },
        business: {
          customerVat,
          supplierVat: supplierVatAmount,
          netDue: businessNetDue,
        },
        discrepancies: {
          collected: roundCents(collected - customerVat),
          deductible: roundCents(deductible - supplierVatAmount),
          netDue: roundCents(accountingNetDue - businessNetDue),
        },
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[getVatControl]", error);
    return { success: false, error: "Erreur lors du contrôle TVA" };
  }
}

export async function liquidateVatPeriod(
  societyId: string,
  filters: { dateFrom?: string; dateTo?: string } = {}
): Promise<ActionResult<VatLiquidationResult>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const reference = buildVatPeriodReference(filters);
    const existing = await prisma.journalEntry.findFirst({
      where: { societyId, reference },
      select: { id: true },
    });
    if (existing) {
      return { success: true, data: { id: existing.id, alreadyExists: true } };
    }

    const control = await getVatControl(societyId, filters);
    if (!control.success || !control.data) {
      return { success: false, error: control.error ?? "Contrôle TVA indisponible" };
    }

    const hasDiscrepancy =
      Math.abs(control.data.discrepancies.collected) > 0.01 ||
      Math.abs(control.data.discrepancies.deductible) > 0.01 ||
      Math.abs(control.data.discrepancies.netDue) > 0.01;
    if (hasDiscrepancy) {
      return {
        success: false,
        error: "Impossible de liquider la TVA tant que le contrôle présente des écarts",
      };
    }

    const vatAccountLines = control.data.accounting.accounts
      .filter((account) => account.kind !== "OTHER" && Math.abs(account.balance) > 0.01)
      .map((account) => ({
        accountId: account.accountId,
        debit: account.balance > 0 ? roundCents(account.balance) : 0,
        credit: account.balance < 0 ? roundCents(Math.abs(account.balance)) : 0,
        label: `Solde ${account.code} - ${account.label}`,
      }));

    if (vatAccountLines.length === 0) {
      return { success: false, error: "Aucun solde de TVA à liquider sur la période" };
    }

    const entry = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.journalEntry.findFirst({
        where: { societyId, reference },
        select: { id: true },
      });
      if (duplicate) return { id: duplicate.id, alreadyExists: true };

      const debit = roundCents(vatAccountLines.reduce((sum, line) => sum + line.debit, 0));
      const credit = roundCents(vatAccountLines.reduce((sum, line) => sum + line.credit, 0));
      const lines = [...vatAccountLines];

      if (debit > credit) {
        const account = await ensureVatAccount(tx, societyId, "445510", "TVA à décaisser");
        lines.push({
          accountId: account.id,
          debit: 0,
          credit: roundCents(debit - credit),
          label: "TVA à décaisser",
        });
      } else if (credit > debit) {
        const account = await ensureVatAccount(tx, societyId, "445670", "Crédit de TVA à reporter");
        lines.push({
          accountId: account.id,
          debit: roundCents(credit - debit),
          credit: 0,
          label: "Crédit de TVA à reporter",
        });
      }

      const entryDate = filters.dateTo ? new Date(filters.dateTo) : new Date();
      const created = await tx.journalEntry.create({
        data: {
          societyId,
          journalType: "OD",
          entryDate,
          piece: "TVA",
          label: `Liquidation TVA ${filters.dateFrom ?? ""} - ${filters.dateTo ?? ""}`.trim(),
          reference,
          status: "BROUILLON",
          lines: { create: lines },
        },
        select: { id: true },
      });

      return { id: created.id, alreadyExists: false };
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: entry.id,
      details: {
        action: "VAT_LIQUIDATION",
        reference,
        netDue: control.data.accounting.netDue,
        alreadyExists: entry.alreadyExists,
      },
    });

    revalidatePath("/comptabilite/tva");
    revalidatePath("/comptabilite");
    return { success: true, data: entry };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[liquidateVatPeriod]", error);
    return { success: false, error: "Erreur lors de la liquidation TVA" };
  }
}
