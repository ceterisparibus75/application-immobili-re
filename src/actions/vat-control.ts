"use server";

import type { ActionResult } from "@/actions/society";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
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

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function getVatKind(code: string): VatAccountRow["kind"] {
  if (code.startsWith("4457")) return "COLLECTED";
  if (code.startsWith("4456")) return "DEDUCTIBLE";
  return "OTHER";
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
