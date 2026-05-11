"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { createFiscalYearSchema } from "@/validations/accounting";
import {
  buildFiscalYearCloseChecklist,
  ensureAccountingAccount,
  roundCents,
  type FiscalYearCloseChecklist,
  type FiscalYearRow,
  type OpeningEntryLine,
} from "@/actions/accounting-shared";

// ─── Exercices fiscaux ────────────────────────────────────────────────────────

export async function getFiscalYears(societyId: string): Promise<ActionResult<FiscalYearRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    const rows = await prisma.fiscalYear.findMany({
      where: { societyId },
      include: {
        closedBy: { select: { firstName: true, name: true } },
      },
      orderBy: { year: "desc" },
    });

    return { success: true, data: rows };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getFiscalYears]", error);
    return { success: false, error: "Erreur lors de la récupération des exercices" };
  }
}

export async function createFiscalYear(
  societyId: string,
  input: { year: number; startDate: string; endDate: string }
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = createFiscalYearSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const existing = await prisma.fiscalYear.findUnique({
      where: { societyId_year: { societyId, year: parsed.data.year } },
    });
    if (existing) return { success: false, error: `L'exercice ${parsed.data.year} existe déjà` };

    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        societyId,
        year: parsed.data.year,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "FiscalYear",
      entityId: fiscalYear.id,
      details: { year: parsed.data.year },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { id: fiscalYear.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createFiscalYear]", error);
    return { success: false, error: "Erreur lors de la création de l'exercice" };
  }
}

export async function closeFiscalYear(societyId: string, fiscalYearId: string): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const checklist = await buildFiscalYearCloseChecklist(societyId, fiscalYearId);
    if (!checklist) return { success: false, error: "Exercice introuvable" };
    if (checklist.isClosed) return { success: false, error: "Cet exercice est déjà clôturé" };
    const blockingCheck = checklist.checks.find((check) => check.status === "BLOCKING");
    if (blockingCheck) return { success: false, error: blockingCheck.detail };

    await prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: { isClosed: true, closedAt: new Date(), closedById: context.userId },
    });

    // Marquer toutes les écritures comme CLOTUREES
    await prisma.journalEntry.updateMany({
      where: { societyId, fiscalYearId },
      data: { status: "CLOTUREE" },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "FiscalYear",
      entityId: fiscalYearId,
      details: { action: "close", year: checklist.year },
    });

    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[closeFiscalYear]", error);
    return { success: false, error: "Erreur lors de la clôture" };
  }
}

export async function getFiscalYearCloseChecklist(
  societyId: string,
  fiscalYearId: string
): Promise<ActionResult<FiscalYearCloseChecklist>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const checklist = await buildFiscalYearCloseChecklist(societyId, fiscalYearId);
    if (!checklist) return { success: false, error: "Exercice introuvable" };

    return { success: true, data: checklist };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getFiscalYearCloseChecklist]", error);
    return { success: false, error: "Erreur lors du contrôle de clôture" };
  }
}

export async function generateOpeningEntries(
  societyId: string,
  sourceFiscalYearId: string
): Promise<ActionResult<{ id: string; alreadyExists: boolean }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const source = await prisma.fiscalYear.findFirst({
      where: { id: sourceFiscalYearId, societyId },
      select: { id: true, year: true, startDate: true, endDate: true, isClosed: true },
    });
    if (!source) return { success: false, error: "Exercice source introuvable" };
    if (!source.isClosed) {
      return { success: false, error: "Les à-nouveaux ne peuvent être générés qu'après clôture de l'exercice source" };
    }

    const target = await prisma.fiscalYear.findUnique({
      where: { societyId_year: { societyId, year: source.year + 1 } },
      select: { id: true, year: true, startDate: true, isClosed: true },
    });
    if (!target) {
      return { success: false, error: `Créez d'abord l'exercice ${source.year + 1} pour générer les à-nouveaux` };
    }
    if (target.isClosed) {
      return { success: false, error: `Impossible de générer les à-nouveaux dans l'exercice ${target.year} déjà clôturé` };
    }

    const reference = `opening:${source.id}:${target.id}`;
    const existing = await prisma.journalEntry.findFirst({
      where: { societyId, reference },
      select: { id: true },
    });
    if (existing) return { success: true, data: { id: existing.id, alreadyExists: true } };

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        account: { societyId },
        journalEntry: {
          entryDate: { gte: source.startDate, lte: source.endDate },
        },
      },
      select: {
        debit: true,
        credit: true,
        accountId: true,
        account: { select: { code: true, label: true, type: true } },
      },
    });

    const totals = new Map<string, { accountId: string; code: string; label: string; type: string; debit: number; credit: number }>();
    for (const line of lines) {
      const current = totals.get(line.accountId) ?? {
        accountId: line.accountId,
        code: line.account.code,
        label: line.account.label,
        type: line.account.type,
        debit: 0,
        credit: 0,
      };
      current.debit = roundCents(current.debit + line.debit);
      current.credit = roundCents(current.credit + line.credit);
      totals.set(line.accountId, current);
    }

    const openingLines: OpeningEntryLine[] = [];
    let products = 0;
    let charges = 0;
    for (const account of [...totals.values()].sort((a, b) => a.code.localeCompare(b.code))) {
      if (account.type === "6") {
        charges = roundCents(charges + account.debit - account.credit);
        continue;
      }
      if (account.type === "7") {
        products = roundCents(products + account.credit - account.debit);
        continue;
      }
      if (!["1", "2", "3", "4", "5"].includes(account.type)) continue;

      const balance = roundCents(account.debit - account.credit);
      if (Math.abs(balance) <= 0.01) continue;
      openingLines.push({
        accountId: account.accountId,
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? Math.abs(balance) : 0,
        label: `A-nouveau ${account.code} - ${account.label}`,
      });
    }

    const result = roundCents(products - charges);
    if (result > 0) {
      const resultAccount = await ensureAccountingAccount(societyId, "120000", "Résultat de l'exercice (bénéfice)", "1");
      openingLines.push({ accountId: resultAccount.id, debit: 0, credit: result, label: "Résultat bénéficiaire reporté" });
    } else if (result < 0) {
      const resultAccount = await ensureAccountingAccount(societyId, "129000", "Résultat de l'exercice (perte)", "1");
      openingLines.push({ accountId: resultAccount.id, debit: Math.abs(result), credit: 0, label: "Résultat déficitaire reporté" });
    }

    const debit = roundCents(openingLines.reduce((sum, line) => sum + line.debit, 0));
    const credit = roundCents(openingLines.reduce((sum, line) => sum + line.credit, 0));
    if (openingLines.length < 2 || Math.abs(debit - credit) > 0.01) {
      return { success: false, error: "Impossible de générer des à-nouveaux équilibrés" };
    }

    const entry = await prisma.journalEntry.create({
      data: {
        societyId,
        fiscalYearId: target.id,
        journalType: "AN",
        entryDate: target.startDate,
        piece: `AN-${target.year}`,
        label: `À-nouveaux ${target.year}`,
        reference,
        status: "BROUILLON",
        lines: { create: openingLines },
      },
      select: { id: true },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: entry.id,
      details: { action: "GENERATE_OPENING_ENTRIES", sourceFiscalYearId, targetFiscalYearId: target.id },
    });

    revalidatePath("/comptabilite");
    revalidatePath("/comptabilite/cloture");
    return { success: true, data: { id: entry.id, alreadyExists: false } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[generateOpeningEntries]", error);
    return { success: false, error: "Erreur lors de la génération des à-nouveaux" };
  }
}
