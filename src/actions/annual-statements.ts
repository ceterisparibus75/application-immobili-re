"use server";

import type { ActionResult } from "@/actions/society";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

export type AnnualStatementLine = {
  accountId: string;
  code: string;
  label: string;
  amount: number;
};

export type AnnualStatements = {
  fiscalYear: {
    id: string;
    year: number;
    startDate: Date;
    endDate: Date;
  };
  balanceSheet: {
    assets: AnnualStatementLine[];
    liabilities: AnnualStatementLine[];
    totalAssets: number;
    totalLiabilities: number;
    result: number;
    balanced: boolean;
  };
  incomeStatement: {
    charges: AnnualStatementLine[];
    products: AnnualStatementLine[];
    totalCharges: number;
    totalProducts: number;
    result: number;
  };
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function pushLine(lines: AnnualStatementLine[], line: AnnualStatementLine): void {
  if (Math.abs(line.amount) <= 0.01) return;
  lines.push({ ...line, amount: roundCents(line.amount) });
}

export async function getAnnualStatements(
  societyId: string,
  fiscalYearId: string
): Promise<ActionResult<AnnualStatements>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, societyId },
      select: { id: true, year: true, startDate: true, endDate: true },
    });
    if (!fiscalYear) return { success: false, error: "Exercice introuvable" };

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        account: { societyId },
        journalEntry: {
          entryDate: {
            gte: fiscalYear.startDate,
            lte: fiscalYear.endDate,
          },
        },
      },
      select: {
        debit: true,
        credit: true,
        account: { select: { id: true, code: true, label: true, type: true } },
      },
    });

    const byAccount = new Map<
      string,
      { accountId: string; code: string; label: string; classe: string; debit: number; credit: number }
    >();
    for (const line of lines) {
      const key = line.account.id;
      const current = byAccount.get(key) ?? {
        accountId: line.account.id,
        code: line.account.code,
        label: line.account.label,
        classe: line.account.type,
        debit: 0,
        credit: 0,
      };
      current.debit = roundCents(current.debit + line.debit);
      current.credit = roundCents(current.credit + line.credit);
      byAccount.set(key, current);
    }

    const assets: AnnualStatementLine[] = [];
    const liabilities: AnnualStatementLine[] = [];
    const charges: AnnualStatementLine[] = [];
    const products: AnnualStatementLine[] = [];

    for (const account of [...byAccount.values()].sort((a, b) => a.code.localeCompare(b.code))) {
      const debitBalance = roundCents(account.debit - account.credit);
      const creditBalance = roundCents(account.credit - account.debit);
      const baseLine = {
        accountId: account.accountId,
        code: account.code,
        label: account.label,
      };

      if (account.classe === "6") {
        pushLine(charges, { ...baseLine, amount: debitBalance });
      } else if (account.classe === "7") {
        pushLine(products, { ...baseLine, amount: creditBalance });
      } else if (["2", "3", "5"].includes(account.classe)) {
        if (debitBalance >= 0) pushLine(assets, { ...baseLine, amount: debitBalance });
        else pushLine(liabilities, { ...baseLine, amount: creditBalance });
      } else if (account.classe === "1") {
        if (creditBalance >= 0) pushLine(liabilities, { ...baseLine, amount: creditBalance });
        else pushLine(assets, { ...baseLine, amount: debitBalance });
      } else if (account.classe === "4") {
        if (debitBalance >= 0) pushLine(assets, { ...baseLine, amount: debitBalance });
        else pushLine(liabilities, { ...baseLine, amount: creditBalance });
      }
    }

    const totalCharges = roundCents(charges.reduce((sum, line) => sum + line.amount, 0));
    const totalProducts = roundCents(products.reduce((sum, line) => sum + line.amount, 0));
    const result = roundCents(totalProducts - totalCharges);
    const totalAssetsBeforeResult = roundCents(assets.reduce((sum, line) => sum + line.amount, 0));
    const totalLiabilitiesBeforeResult = roundCents(liabilities.reduce((sum, line) => sum + line.amount, 0));

    if (result >= 0) {
      liabilities.push({
        accountId: "result",
        code: "120000",
        label: "Résultat de l'exercice",
        amount: result,
      });
    } else {
      assets.push({
        accountId: "result",
        code: "129000",
        label: "Résultat de l'exercice",
        amount: Math.abs(result),
      });
    }

    const totalAssets = roundCents(totalAssetsBeforeResult + (result < 0 ? Math.abs(result) : 0));
    const totalLiabilities = roundCents(totalLiabilitiesBeforeResult + (result >= 0 ? result : 0));

    return {
      success: true,
      data: {
        fiscalYear,
        balanceSheet: {
          assets,
          liabilities,
          totalAssets,
          totalLiabilities,
          result,
          balanced: Math.abs(totalAssets - totalLiabilities) <= 0.01,
        },
        incomeStatement: {
          charges,
          products,
          totalCharges,
          totalProducts,
          result,
        },
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getAnnualStatements]", error);
    return { success: false, error: "Erreur lors du calcul des états annuels" };
  }
}
