"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/actions/society";
import { createAuditLog } from "@/lib/audit";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import type { AccountReviewStatus } from "@/generated/prisma/client";

export type AccountReviewRow = {
  accountId: string;
  code: string;
  label: string;
  classe: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  status: AccountReviewStatus;
  note: string | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
};

export type AccountReviewBoard = {
  fiscalYearId: string;
  rows: AccountReviewRow[];
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    reviewed: number;
    issue: number;
    completionRate: number;
  };
};

const updateReviewSchema = z.object({
  fiscalYearId: z.string().cuid(),
  accountId: z.string().cuid(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEWED", "ISSUE"]),
  note: z.string().max(5000).optional().nullable(),
});

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildStats(rows: AccountReviewRow[]): AccountReviewBoard["stats"] {
  const total = rows.length;
  const reviewed = rows.filter((row) => row.status === "REVIEWED").length;
  const issue = rows.filter((row) => row.status === "ISSUE").length;
  const inProgress = rows.filter((row) => row.status === "IN_PROGRESS").length;
  const todo = rows.filter((row) => row.status === "TODO").length;

  return {
    total,
    todo,
    inProgress,
    reviewed,
    issue,
    completionRate: total > 0 ? Math.round((reviewed / total) * 100) : 0,
  };
}

export async function getAccountReviewBoard(
  societyId: string,
  fiscalYearId: string
): Promise<ActionResult<AccountReviewBoard>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, societyId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!fiscalYear) return { success: false, error: "Exercice introuvable" };

    const [accounts, lines, reviews] = await Promise.all([
      prisma.accountingAccount.findMany({
        where: { societyId, isActive: true },
        select: { id: true, code: true, label: true, type: true },
        orderBy: { code: "asc" },
      }),
      prisma.journalEntryLine.findMany({
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
          accountId: true,
        },
      }),
      prisma.accountReview.findMany({
        where: { societyId, fiscalYearId },
        select: {
          accountId: true,
          status: true,
          note: true,
          reviewedAt: true,
          reviewedById: true,
        },
      }),
    ]);

    const totals = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
      const current = totals.get(line.accountId) ?? { debit: 0, credit: 0 };
      current.debit = roundCents(current.debit + line.debit);
      current.credit = roundCents(current.credit + line.credit);
      totals.set(line.accountId, current);
    }

    const reviewByAccount = new Map(reviews.map((review) => [review.accountId, review]));
    const rows: AccountReviewRow[] = accounts.map((account) => {
      const total = totals.get(account.id) ?? { debit: 0, credit: 0 };
      const review = reviewByAccount.get(account.id);
      return {
        accountId: account.id,
        code: account.code,
        label: account.label,
        classe: account.type,
        totalDebit: roundCents(total.debit),
        totalCredit: roundCents(total.credit),
        balance: roundCents(total.debit - total.credit),
        status: review?.status ?? "TODO",
        note: review?.note ?? null,
        reviewedAt: review?.reviewedAt ?? null,
        reviewedById: review?.reviewedById ?? null,
      };
    });

    return {
      success: true,
      data: {
        fiscalYearId,
        rows,
        stats: buildStats(rows),
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getAccountReviewBoard]", error);
    return { success: false, error: "Erreur lors du chargement de la révision" };
  }
}

export async function updateAccountReview(
  societyId: string,
  input: z.infer<typeof updateReviewSchema>
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = updateReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((error) => error.message).join(", "),
      };
    }

    const [fiscalYear, account] = await Promise.all([
      prisma.fiscalYear.findFirst({
        where: { id: parsed.data.fiscalYearId, societyId },
        select: { id: true },
      }),
      prisma.accountingAccount.findFirst({
        where: { id: parsed.data.accountId, societyId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!fiscalYear) return { success: false, error: "Exercice introuvable" };
    if (!account) return { success: false, error: "Compte introuvable" };

    const reviewedAt = parsed.data.status === "REVIEWED" ? new Date() : null;
    const reviewedById = parsed.data.status === "REVIEWED" ? context.userId : null;
    const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;

    await prisma.accountReview.upsert({
      where: {
        societyId_fiscalYearId_accountId: {
          societyId,
          fiscalYearId: parsed.data.fiscalYearId,
          accountId: parsed.data.accountId,
        },
      },
      update: {
        status: parsed.data.status,
        note,
        reviewedAt,
        reviewedById,
      },
      create: {
        societyId,
        fiscalYearId: parsed.data.fiscalYearId,
        accountId: parsed.data.accountId,
        status: parsed.data.status,
        note,
        reviewedAt,
        reviewedById,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "AccountReview",
      entityId: parsed.data.accountId,
      details: {
        fiscalYearId: parsed.data.fiscalYearId,
        status: parsed.data.status,
      },
    });

    revalidatePath("/comptabilite/revision");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateAccountReview]", error);
    return { success: false, error: "Erreur lors de la mise à jour de la révision" };
  }
}
