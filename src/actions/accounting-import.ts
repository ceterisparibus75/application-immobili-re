"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { JournalType } from "@/generated/prisma/client";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { resolveOpenFiscalYearIdForDate } from "@/lib/accounting-period";
import { validateDebitCreditLines } from "@/actions/accounting-shared";

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
    accountLabel?: string;
    label?: string;
    debit: number;
    credit: number;
  }>;
};

export type BulkImportJournalEntriesOptions = {
  createMissingAccounts?: boolean;
  allowUnbalancedEntries?: boolean;
};

export type SkippedImportJournalEntry = {
  journalType: string;
  entryDate: string;
  piece?: string;
  label: string;
  reason: string;
};

function normalizeJournalType(code: string): JournalType | null {
  const c = code.toUpperCase().trim();
  if (c === "AN") return "AN";
  if (c === "AC" || c.startsWith("ACH")) return "AC";
  if (c === "BQUE" || c === "BQ" || c === "BNQ" || c.startsWith("BAN")) return "BQUE";
  if (c === "INV" || c.startsWith("INV")) return "INV";
  if (c === "VT" || c.startsWith("VEN") || c === "FAC") return "VT";
  if (c === "OD" || c.startsWith("OP")) return "OD";
  return null;
}

export async function bulkImportJournalEntries(
  societyId: string,
  entries: ImportJournalEntryInput[],
  options: BulkImportJournalEntriesOptions = {},
): Promise<ActionResult<{ imported: number; skipped: number; errors: string[]; skippedDetails: SkippedImportJournalEntry[] }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    if (!entries.length) return { success: false, error: "Aucune écriture à importer" };
    if (entries.length > 2000) return { success: false, error: "Maximum 2000 écritures par import" };

    let accounts = await prisma.accountingAccount.findMany({
      where: { societyId },
      select: { id: true, code: true },
    });
    let accountMap = new Map(accounts.map((a) => [a.code, a.id]));

    if (options.createMissingAccounts) {
      const labelsByCode = new Map<string, string>();
      for (const entry of entries) {
        for (const line of entry.lines) {
          const code = line.accountCode.trim();
          if (!code || accountMap.has(code)) continue;
          labelsByCode.set(code, (line.accountLabel ?? code).trim() || code);
        }
      }

      const missingAccounts = Array.from(labelsByCode.entries());
      if (missingAccounts.length > 0) {
        await prisma.accountingAccount.createMany({
          data: missingAccounts.map(([code, label]) => ({
            societyId,
            code,
            label,
            type: /^\d/.test(code) ? code[0] : "AUX",
            isActive: true,
          })),
          skipDuplicates: true,
        });
        accounts = await prisma.accountingAccount.findMany({
          where: { societyId },
          select: { id: true, code: true },
        });
        accountMap = new Map(accounts.map((a) => [a.code, a.id]));
      }
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const skippedDetails: SkippedImportJournalEntry[] = [];

    const recordSkipped = (entry: ImportJournalEntryInput, reason: string) => {
      skipped++;
      skippedDetails.push({
        journalType: entry.journalType,
        entryDate: entry.entryDate,
        piece: entry.piece,
        label: entry.label,
        reason,
      });
    };

    for (const entry of entries) {
      try {
        const journalType = normalizeJournalType(entry.journalType);
        if (!journalType) {
          if (errors.length < 20) errors.push(`Journal ${entry.journalType} non supporté`);
          recordSkipped(entry, `Journal ${entry.journalType} non supporté`);
          continue;
        }
        if (!options.allowUnbalancedEntries && entry.lines.length < 2) {
          if (errors.length < 20) errors.push(`Écriture ${entry.piece ?? entry.label}: Au moins 2 lignes requises`);
          recordSkipped(entry, "Au moins 2 lignes requises");
          continue;
        }
        const lineValidationError = validateDebitCreditLines(entry.lines);
        if (lineValidationError) {
          if (errors.length < 20) errors.push(`Écriture ${entry.piece ?? entry.label}: ${lineValidationError}`);
          recordSkipped(entry, lineValidationError);
          continue;
        }
        const entryDate = new Date(entry.entryDate);
        const fiscalYearId = await resolveOpenFiscalYearIdForDate(prisma, societyId, entryDate);
        if (!fiscalYearId) {
          if (errors.length < 20) errors.push(`Écriture ${entry.piece ?? entry.label}: aucun exercice fiscal ouvert`);
          recordSkipped(entry, "Aucun exercice fiscal ouvert");
          continue;
        }

        const existing = await prisma.journalEntry.findFirst({
          where: {
            societyId,
            journalType,
            entryDate,
            ...(entry.piece ? { piece: entry.piece } : { label: entry.label }),
          },
        });
        if (existing) {
          recordSkipped(entry, "Écriture déjà présente");
          continue;
        }

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
        if (lineError) {
          recordSkipped(entry, "Compte introuvable");
          continue;
        }

        const totalDebit = resolvedLines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = resolvedLines.reduce((sum, line) => sum + line.credit, 0);
        if (!options.allowUnbalancedEntries && Math.abs(totalDebit - totalCredit) > 0.01) {
          if (errors.length < 20) {
            errors.push(`Écriture ${entry.piece ?? entry.label}: non équilibrée`);
          }
          recordSkipped(entry, "Écriture non équilibrée");
          continue;
        }

        await prisma.journalEntry.create({
          data: {
            societyId,
            journalType,
            entryDate,
            piece: entry.piece,
            label: entry.label.slice(0, 255),
            reference: entry.reference,
            fiscalYearId,
            status: "BROUILLON",
            lines: { create: resolvedLines },
          },
        });
        imported++;
      } catch (e) {
        const reason = e instanceof Error ? e.message : "Erreur";
        if (errors.length < 20) errors.push(`Écriture ${entry.piece ?? ""}: ${reason}`);
        recordSkipped(entry, reason);
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
    return { success: true, data: { imported, skipped, errors, skippedDetails } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[bulkImportJournalEntries]", error);
    return { success: false, error: "Erreur lors de l'import" };
  }
}

// ─── Plan comptable immobilier par défaut ────────────────────────────────────

const DEFAULT_REAL_ESTATE_ACCOUNTS: Array<{ code: string; label: string; type: string; accountType: string; sensNormal: string }> = [
  // Classe 1 — Capitaux
  { code: "101000", label: "Capital social", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "104000", label: "Primes liées au capital social", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "106000", label: "Réserves", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "110000", label: "Report à nouveau (solde créditeur)", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "119000", label: "Report à nouveau (solde débiteur)", type: "1", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "120000", label: "Résultat de l'exercice (bénéfice)", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "129000", label: "Résultat de l'exercice (perte)", type: "1", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "164000", label: "Emprunts auprès des établissements de crédit", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "165000", label: "Dépôts et cautionnements reçus", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  // Classe 2 — Immobilisations
  { code: "211000", label: "Terrains nus", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "212000", label: "Terrains aménagés", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "213100", label: "Immeubles d'habitation", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "213200", label: "Immeubles commerciaux", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "215700", label: "Équipements ménagers et électroménager", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "218000", label: "Matériel et mobilier", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "281310", label: "Amortissements — Immeubles d'habitation", type: "2", accountType: "BILAN_ACTIF", sensNormal: "C" },
  { code: "281320", label: "Amortissements — Immeubles commerciaux", type: "2", accountType: "BILAN_ACTIF", sensNormal: "C" },
  // Classe 4 — Tiers
  { code: "401000", label: "Fournisseurs", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "408000", label: "Fournisseurs — Factures non parvenues", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "411000", label: "Locataires", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "416000", label: "Locataires douteux ou litigieux", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "421000", label: "Personnel — Rémunérations dues", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "431000", label: "Sécurité sociale", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "441000", label: "État — Impôts sur bénéfices", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "445510", label: "TVA à décaisser", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "445620", label: "TVA déductible sur immobilisations", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "445660", label: "TVA déductible sur autres biens et services", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "445710", label: "TVA collectée", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "455000", label: "Associés — Comptes courants", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "467000", label: "Autres comptes débiteurs ou créditeurs", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "486000", label: "Charges constatées d'avance", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "487000", label: "Produits constatés d'avance", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  // Classe 5 — Financiers
  { code: "512000", label: "Banques", type: "5", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "530000", label: "Caisse", type: "5", accountType: "BILAN_ACTIF", sensNormal: "D" },
  // Classe 6 — Charges
  { code: "606100", label: "Énergie — Électricité parties communes", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "606120", label: "Eau — Parties communes", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "606130", label: "Gaz — Parties communes", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "606400", label: "Fournitures administratives et de bureau", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "611000", label: "Sous-traitance générale", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "613200", label: "Locations immobilières", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "614000", label: "Charges locatives récupérables", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "615100", label: "Entretien et réparations des bâtiments", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "615200", label: "Entretien et réparations du matériel", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "616100", label: "Assurance multirisque immeuble", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "616200", label: "Assurance loyers impayés", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "622600", label: "Honoraires (syndic, gestionnaire, expert-comptable)", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "622700", label: "Frais d'actes et de contentieux", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "623100", label: "Annonces et insertions (publicité location)", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "626000", label: "Frais postaux et de télécommunications", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "627000", label: "Services bancaires et assimilés", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "631000", label: "Impôts et taxes divers", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "635100", label: "Taxe foncière", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "635200", label: "Contribution économique territoriale (CET)", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "641000", label: "Rémunérations du personnel", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "645000", label: "Charges de sécurité sociale et de prévoyance", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "661100", label: "Intérêts des emprunts et dettes", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "671000", label: "Charges exceptionnelles sur opérations de gestion", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "681100", label: "Dotations aux amortissements des immobilisations", type: "6", accountType: "CHARGE", sensNormal: "D" },
  // Classe 7 — Produits
  { code: "706100", label: "Loyers — Locaux d'habitation", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "706200", label: "Loyers — Locaux commerciaux", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "706300", label: "Loyers — Parkings et garages", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "706400", label: "Loyers — Terrains et locaux divers", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "706500", label: "Refacturation de charges locatives", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "708500", label: "Pénalités et intérêts de retard locataires", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "754000", label: "Subventions et aides au logement (APL, ALS…)", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "762000", label: "Produits des participations financières", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "775000", label: "Produits des cessions d'éléments d'actif", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "781100", label: "Reprises sur amortissements des immobilisations", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "791000", label: "Transferts de charges d'exploitation", type: "7", accountType: "PRODUIT", sensNormal: "C" },
];

export async function initDefaultChartOfAccounts(
  societyId: string
): Promise<ActionResult<{ created: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const existing = await prisma.accountingAccount.count({ where: { societyId } });
    if (existing > 0) {
      return { success: false, error: `Le plan comptable contient déjà ${existing} compte(s). Utilisez l'import pour ajouter des comptes.` };
    }

    const result = await prisma.accountingAccount.createMany({
      data: DEFAULT_REAL_ESTATE_ACCOUNTS.map((a) => ({
        societyId,
        code: a.code,
        label: a.label,
        type: a.type,
        accountType: a.accountType as never,
        sensNormal: a.sensNormal as never,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "AccountingAccount",
      entityId: societyId,
      details: { action: "INIT_DEFAULT_CHART", created: result.count },
    });

    revalidatePath("/comptabilite/plan-comptable");
    return { success: true, data: { created: result.count } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[initDefaultChartOfAccounts]", error);
    return { success: false, error: "Erreur lors de l'initialisation du plan comptable" };
  }
}

