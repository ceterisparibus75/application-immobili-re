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
import {
  createFiscalYearSchema,
  createJournalEntrySchema,
} from "@/validations/accounting";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FiscalYearRow = {
  id: string;
  year: number;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  closedBy: { firstName: string | null; name: string | null } | null;
  closedAt: Date | null;
};

export type AccountRow = {
  id: string;
  code: string;
  label: string;
  type: string;
};

export type BalanceRow = {
  accountId: string;
  code: string;
  label: string;
  classe: string;
  totalDebit: number;
  totalCredit: number;
  soldeDebiteur: number;
  soldeCrediteur: number;
};

export type GrandLivreRow = {
  id: string;
  date: Date;
  piece: string | null;
  journalType: string;
  label: string;
  debit: number;
  credit: number;
  solde: number;
  lettrage: string | null;
  status: string;
  accountCode: string;
  accountLabel: string;
};

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

    const fy = await prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, societyId } });
    if (!fy) return { success: false, error: "Exercice introuvable" };
    if (fy.isClosed) return { success: false, error: "Cet exercice est déjà clôturé" };

    // Vérifier qu'il n'y a pas d'écritures en brouillon
    const drafts = await prisma.journalEntry.count({
      where: { societyId, fiscalYearId, status: "BROUILLON" },
    });
    if (drafts > 0) {
      return { success: false, error: `Il reste ${drafts} écriture(s) en brouillon à valider avant la clôture` };
    }

    // Vérifier l'équilibre débit/crédit
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntry: { societyId, fiscalYearId } },
      select: { debit: true, credit: true },
    });
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        error: `La balance n'est pas équilibrée (débit ${totalDebit.toFixed(2)} € ≠ crédit ${totalCredit.toFixed(2)} €)`,
      };
    }

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
      details: { action: "close", year: fy.year },
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

// ─── Comptes ──────────────────────────────────────────────────────────────────

export async function getAccounts(societyId: string): Promise<ActionResult<AccountRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    const accounts = await prisma.accountingAccount.findMany({
      where: { societyId, isActive: true },
      select: { id: true, code: true, label: true, type: true },
      orderBy: { code: "asc" },
    });

    return { success: true, data: accounts };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getAccounts]", error);
    return { success: false, error: "Erreur lors de la récupération des comptes" };
  }
}

// ─── Balance ──────────────────────────────────────────────────────────────────

export async function getBalance(
  societyId: string,
  filters: { fiscalYearId?: string; classe?: string; dateFrom?: string; dateTo?: string }
): Promise<ActionResult<BalanceRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        account: {
          societyId,
          ...(filters.classe ? { type: filters.classe } : {}),
        },
        journalEntry: {
          ...(filters.fiscalYearId ? { fiscalYearId: filters.fiscalYearId } : {}),
          ...(filters.dateFrom ? { entryDate: { gte: new Date(filters.dateFrom) } } : {}),
          ...(filters.dateTo
            ? { entryDate: { ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}), lte: new Date(filters.dateTo) } }
            : {}),
        },
      },
      select: {
        debit: true,
        credit: true,
        account: { select: { id: true, code: true, label: true, type: true } },
      },
    });

    // Agréger par compte
    const map = new Map<string, BalanceRow>();
    for (const line of lines) {
      const key = line.account.id;
      if (!map.has(key)) {
        map.set(key, {
          accountId: line.account.id,
          code: line.account.code,
          label: line.account.label,
          classe: line.account.type,
          totalDebit: 0,
          totalCredit: 0,
          soldeDebiteur: 0,
          soldeCrediteur: 0,
        });
      }
      const b = map.get(key)!;
      b.totalDebit += line.debit;
      b.totalCredit += line.credit;
    }

    const data: BalanceRow[] = [...map.values()].map((b) => {
      const diff = b.totalDebit - b.totalCredit;
      return {
        ...b,
        soldeDebiteur: diff > 0 ? diff : 0,
        soldeCrediteur: diff < 0 ? -diff : 0,
      };
    }).sort((a, b) => a.code.localeCompare(b.code));

    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getBalance]", error);
    return { success: false, error: "Erreur lors du calcul de la balance" };
  }
}

// ─── Grand Livre ──────────────────────────────────────────────────────────────

export async function getGrandLivre(
  societyId: string,
  filters: { accountId?: string; fiscalYearId?: string; journalType?: string; dateFrom?: string; dateTo?: string }
): Promise<ActionResult<GrandLivreRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        account: { societyId },
        journalEntry: {
          ...(filters.fiscalYearId ? { fiscalYearId: filters.fiscalYearId } : {}),
          ...(filters.journalType ? { journalType: filters.journalType as never } : {}),
          ...(filters.dateFrom ? { entryDate: { gte: new Date(filters.dateFrom) } } : {}),
          ...(filters.dateTo
            ? { entryDate: { ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}), lte: new Date(filters.dateTo) } }
            : {}),
        },
      },
      include: {
        account: { select: { code: true, label: true } },
        journalEntry: {
          select: { entryDate: true, piece: true, journalType: true, label: true, status: true },
        },
      },
      orderBy: [{ journalEntry: { entryDate: "asc" } }, { id: "asc" }],
    });

    // Calcul du solde cumulé
    let solde = 0;
    const data: GrandLivreRow[] = lines.map((line) => {
      solde += line.debit - line.credit;
      return {
        id: line.id,
        date: line.journalEntry.entryDate,
        piece: line.journalEntry.piece,
        journalType: line.journalEntry.journalType,
        label: line.label ?? line.journalEntry.label,
        debit: line.debit,
        credit: line.credit,
        solde,
        lettrage: line.lettrage,
        status: line.journalEntry.status,
        accountCode: line.account.code,
        accountLabel: line.account.label,
      };
    });

    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getGrandLivre]", error);
    return { success: false, error: "Erreur lors de la récupération du grand livre" };
  }
}

// ─── Écritures ────────────────────────────────────────────────────────────────

export async function createJournalEntry(
  societyId: string,
  input: {
    journalType: string;
    entryDate: string;
    piece?: string;
    label: string;
    fiscalYearId?: string;
    lines: Array<{ accountId: string; label?: string; debit: number; credit: number }>;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = createJournalEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    // Vérifier l'équilibre débit/crédit
    const totalDebit = parsed.data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = parsed.data.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { success: false, error: `L'écriture n'est pas équilibrée (débit ${totalDebit.toFixed(2)} € ≠ crédit ${totalCredit.toFixed(2)} €)` };
    }

    // Vérifier que chaque compte appartient à la société
    const accountIds = [...new Set(parsed.data.lines.map((l) => l.accountId))];
    const accounts = await prisma.accountingAccount.findMany({
      where: { id: { in: accountIds }, societyId },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      return { success: false, error: "Un ou plusieurs comptes sont invalides" };
    }

    const entry = await prisma.journalEntry.create({
      data: {
        societyId,
        journalType: parsed.data.journalType as never,
        entryDate: new Date(parsed.data.entryDate),
        piece: parsed.data.piece,
        label: parsed.data.label,
        fiscalYearId: parsed.data.fiscalYearId,
        status: "BROUILLON",
        lines: {
          create: parsed.data.lines.map((l) => ({
            accountId: l.accountId,
            label: l.label,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: entry.id,
      details: { journalType: input.journalType, piece: input.piece, label: input.label },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { id: entry.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createJournalEntry]", error);
    return { success: false, error: "Erreur lors de la création de l'écriture" };
  }
}

// ─── Import (fonctions conservées) ───────────────────────────────────────────

export async function bulkImportAccounts(
  societyId: string,
  accounts: Array<{ code: string; label: string; type: string; accountType?: string; sensNormal?: string }>,
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    if (!accounts.length) return { success: false, error: "Aucun compte à importer" };
    if (accounts.length > 500) return { success: false, error: "Maximum 500 comptes par import" };

    let imported = 0;
    let skipped = 0;

    for (const account of accounts) {
      const code = account.code.trim().slice(0, 10);
      const label = account.label.trim().slice(0, 255);
      const type = account.type.trim().charAt(0);
      if (!code || !label) { skipped++; continue; }

      const existing = await prisma.accountingAccount.findUnique({
        where: { societyId_code: { societyId, code } },
      });

      if (existing) {
        skipped++;
      } else {
        await prisma.accountingAccount.create({
          data: {
            societyId,
            code,
            label,
            type,
            accountType: (account.accountType as never) ?? null,
            sensNormal: (account.sensNormal as never) ?? null,
            isActive: true,
          },
        });
        imported++;
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "AccountingAccount",
      entityId: societyId,
      details: { action: "BULK_IMPORT", imported, skipped },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { imported, skipped } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[bulkImportAccounts]", error);
    return { success: false, error: "Erreur lors de l'import" };
  }
}

export type ImportJournalEntryInput = {
  journalType: string;
  entryDate: string;
  piece?: string;
  label: string;
  reference?: string;
  lines: Array<{
    accountCode: string;
    label?: string;
    debit: number;
    credit: number;
  }>;
};

function normalizeJournalType(code: string): string {
  const c = code.toUpperCase().trim();
  if (c === "AN") return "AN";
  if (c === "AC" || c.startsWith("ACH")) return "AC";
  if (c === "BQUE" || c === "BQ" || c === "BNQ" || c.startsWith("BAN")) return "BQUE";
  if (c === "INV" || c.startsWith("INV")) return "INV";
  if (c === "VT" || c.startsWith("VEN") || c === "FAC") return "VT";
  return "OD";
}

export async function bulkImportJournalEntries(
  societyId: string,
  entries: ImportJournalEntryInput[],
): Promise<ActionResult<{ imported: number; skipped: number; errors: string[] }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    if (!entries.length) return { success: false, error: "Aucune écriture à importer" };
    if (entries.length > 2000) return { success: false, error: "Maximum 2000 écritures par import" };

    const accounts = await prisma.accountingAccount.findMany({
      where: { societyId },
      select: { id: true, code: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        const journalType = normalizeJournalType(entry.journalType) as never;
        const entryDate = new Date(entry.entryDate);

        const existing = await prisma.journalEntry.findFirst({
          where: {
            societyId,
            journalType,
            entryDate,
            ...(entry.piece ? { piece: entry.piece } : { label: entry.label }),
          },
        });
        if (existing) { skipped++; continue; }

        const resolvedLines: Array<{ accountId: string; label: string; debit: number; credit: number }> = [];
        let lineError = false;
        for (const line of entry.lines) {
          const accountId = accountMap.get(line.accountCode.trim());
          if (!accountId) {
            if (errors.length < 20) errors.push(`Compte ${line.accountCode} introuvable`);
            lineError = true;
            break;
          }
          resolvedLines.push({
            accountId,
            label: (line.label ?? entry.label).slice(0, 255),
            debit: line.debit,
            credit: line.credit,
          });
        }
        if (lineError) { skipped++; continue; }

        await prisma.journalEntry.create({
          data: {
            societyId,
            journalType,
            entryDate,
            piece: entry.piece,
            label: entry.label.slice(0, 255),
            reference: entry.reference,
            status: "BROUILLON",
            lines: { create: resolvedLines },
          },
        });
        imported++;
      } catch (e) {
        if (errors.length < 20) errors.push(`Écriture ${entry.piece ?? ""}: ${e instanceof Error ? e.message : "Erreur"}`);
        skipped++;
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: societyId,
      details: { action: "BULK_IMPORT_ECRITURES", imported, skipped },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { imported, skipped, errors } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[bulkImportJournalEntries]", error);
    return { success: false, error: "Erreur lors de l'import" };
  }
}
