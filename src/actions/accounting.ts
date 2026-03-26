"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

export type FiscalYearRow = {
  id: string;
  year: number;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  closedBy: { firstName: string | null; name: string | null } | null;
  closedAt: Date | null;
};

export async function getFiscalYears(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string
): Promise<ActionResult<FiscalYearRow[]>> {
  return { success: true, data: [] };
}

export async function createFiscalYear(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input: { year: number; startDate: string; endDate: string }
): Promise<ActionResult<{ id: string }>> {
  return { success: false, error: "Fonctionnalité en cours de développement" };
}

export async function closeFiscalYear(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fiscalYearId: string
): Promise<ActionResult> {
  return { success: false, error: "Fonctionnalité en cours de développement" };
}

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

export async function getAccounts(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string
): Promise<ActionResult<AccountRow[]>> {
  return { success: true, data: [] };
}

export async function getBalance(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _filters: { fiscalYearId?: string; classe?: string; dateFrom?: string; dateTo?: string }
): Promise<ActionResult<BalanceRow[]>> {
  return { success: true, data: [] };
}

export async function getGrandLivre(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _filters: { accountId?: string; fiscalYearId?: string; journalType?: string; dateFrom?: string; dateTo?: string }
): Promise<ActionResult<GrandLivreRow[]>> {
  return { success: true, data: [] };
}

export async function createJournalEntry(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input: {
    journalType: string;
    entryDate: string;
    piece?: string;
    label: string;
    fiscalYearId?: string;
    lines: Array<{ accountId: string; label?: string; debit: number; credit: number }>;
  }
): Promise<ActionResult<{ id: string }>> {
  return { success: false, error: "Fonctionnalité en cours de développement" };
}

export async function bulkImportAccounts(
  societyId: string,
  accounts: Array<{ code: string; label: string; type: string; accountType?: string; sensNormal?: string }>,
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

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
      userId: session.user.id,
      action: "CREATE",
      entity: "AccountingAccount",
      entityId: societyId,
      details: { action: "BULK_IMPORT", imported, skipped },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { imported, skipped } };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

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

        // Toujours vérifier les doublons (par pièce+journal+date ou libellé+journal+date)
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
      userId: session.user.id,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: societyId,
      details: { action: "BULK_IMPORT_ECRITURES", imported, skipped },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { imported, skipped, errors } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[bulkImportJournalEntries]", error);
    return { success: false, error: "Erreur lors de l'import" };
  }
}
