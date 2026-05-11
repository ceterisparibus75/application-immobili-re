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
  createJournalEntrySchema,
  validateJournalEntriesSchema,
} from "@/validations/accounting";
import {
  normalizeAccountingJournalType,
  type AccountingJournalType,
} from "@/lib/accounting-journals";
import {
  resolveJournalEntryDocument,
  roundCents,
  validateDebitCreditLines,
} from "@/actions/accounting-shared";

// ─── Écritures ────────────────────────────────────────────────────────────────

export async function createJournalEntry(
  societyId: string,
  input: {
    journalType: string;
    entryDate: string;
    piece?: string;
    label: string;
    fiscalYearId?: string;
    documentId?: string | null;
    lines: Array<{ accountId: string; label?: string; debit: number; credit: number }>;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = createJournalEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const entryDate = new Date(parsed.data.entryDate);
    const journalType = normalizeAccountingJournalType(parsed.data.journalType as AccountingJournalType);

    // Vérifier l'équilibre débit/crédit
    const lineValidationError = validateDebitCreditLines(parsed.data.lines);
    if (lineValidationError) return { success: false, error: lineValidationError };

    const totalDebit = parsed.data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = parsed.data.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { success: false, error: `L'écriture n'est pas équilibrée (débit ${totalDebit.toFixed(2)} € ≠ crédit ${totalCredit.toFixed(2)} €)` };
    }

    const fiscalYear = parsed.data.fiscalYearId
      ? await prisma.fiscalYear.findFirst({
          where: { id: parsed.data.fiscalYearId, societyId },
          select: { id: true, isClosed: true },
        })
      : await prisma.fiscalYear.findFirst({
          where: {
            societyId,
            startDate: { lte: entryDate },
            endDate: { gte: entryDate },
          },
          select: { id: true, isClosed: true },
        });
    if (parsed.data.fiscalYearId && !fiscalYear) return { success: false, error: "Exercice fiscal introuvable" };
    if (!parsed.data.fiscalYearId && !fiscalYear) return { success: false, error: "Aucun exercice fiscal ouvert ne couvre cette date" };
    if (fiscalYear?.isClosed) return { success: false, error: "Impossible de créer une écriture dans un exercice clôturé" };

    // Vérifier que chaque compte appartient à la société
    const accountIds = [...new Set(parsed.data.lines.map((l) => l.accountId))];
    const accounts = await prisma.accountingAccount.findMany({
      where: { id: { in: accountIds }, societyId },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      return { success: false, error: "Un ou plusieurs comptes sont invalides" };
    }

    const documentResolution = await resolveJournalEntryDocument(societyId, parsed.data.documentId);
    if (documentResolution.error) return { success: false, error: documentResolution.error };
    const linkedDocument = documentResolution.document;

    const entry = await prisma.journalEntry.create({
      data: {
        societyId,
        journalType: journalType as never,
        entryDate,
        piece: parsed.data.piece,
        label: parsed.data.label,
        fiscalYearId: fiscalYear?.id,
        documentId: linkedDocument?.id ?? null,
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
      details: { journalType, piece: input.piece, label: input.label, documentId: linkedDocument?.id ?? null },
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

export async function updateJournalEntry(
  societyId: string,
  entryId: string,
  input: {
    journalType: string;
    entryDate: string;
    piece?: string;
    label: string;
    fiscalYearId?: string;
    documentId?: string | null;
    lines: Array<{ accountId: string; label?: string; debit: number; credit: number }>;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const existing = await prisma.journalEntry.findFirst({
      where: { id: entryId, societyId },
      select: { id: true, status: true },
    });
    if (!existing) return { success: false, error: "Écriture introuvable" };
    if (existing.status !== "BROUILLON") {
      return { success: false, error: "Seules les écritures en brouillon peuvent être modifiées" };
    }

    const parsed = createJournalEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const entryDate = new Date(parsed.data.entryDate);
    const journalType = normalizeAccountingJournalType(parsed.data.journalType as AccountingJournalType);

    const lineValidationError = validateDebitCreditLines(parsed.data.lines);
    if (lineValidationError) return { success: false, error: lineValidationError };

    const totalDebit = parsed.data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = parsed.data.lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { success: false, error: `L'écriture n'est pas équilibrée (débit ${totalDebit.toFixed(2)} € ≠ crédit ${totalCredit.toFixed(2)} €)` };
    }

    const fiscalYear = parsed.data.fiscalYearId
      ? await prisma.fiscalYear.findFirst({
          where: { id: parsed.data.fiscalYearId, societyId },
          select: { id: true, isClosed: true },
        })
      : await prisma.fiscalYear.findFirst({
          where: {
            societyId,
            startDate: { lte: entryDate },
            endDate: { gte: entryDate },
          },
          select: { id: true, isClosed: true },
        });
    if (parsed.data.fiscalYearId && !fiscalYear) return { success: false, error: "Exercice fiscal introuvable" };
    if (!parsed.data.fiscalYearId && !fiscalYear) return { success: false, error: "Aucun exercice fiscal ouvert ne couvre cette date" };
    if (fiscalYear?.isClosed) return { success: false, error: "Impossible de modifier une écriture dans un exercice clôturé" };

    const accountIds = [...new Set(parsed.data.lines.map((line) => line.accountId))];
    const accounts = await prisma.accountingAccount.findMany({
      where: { id: { in: accountIds }, societyId },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      return { success: false, error: "Un ou plusieurs comptes sont invalides" };
    }

    const documentResolution = await resolveJournalEntryDocument(societyId, parsed.data.documentId);
    if (documentResolution.error) return { success: false, error: documentResolution.error };
    const linkedDocument = documentResolution.document;

    await prisma.$transaction(async (tx) => {
      await tx.journalEntryLine.deleteMany({ where: { journalEntryId: entryId } });
      await tx.journalEntry.update({
        where: { id: entryId },
        data: {
          journalType: journalType as never,
          entryDate,
          piece: parsed.data.piece,
          label: parsed.data.label,
          fiscalYearId: fiscalYear?.id,
          documentId: linkedDocument?.id ?? null,
          lines: {
            create: parsed.data.lines.map((line) => ({
              accountId: line.accountId,
              label: line.label,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "JournalEntry",
      entityId: entryId,
      details: { action: "update_draft", journalType, piece: input.piece, label: input.label, documentId: linkedDocument?.id ?? null },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { id: entryId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateJournalEntry]", error);
    return { success: false, error: "Erreur lors de la modification de l'écriture" };
  }
}

export async function linkJournalEntryDocument(
  societyId: string,
  entryId: string,
  documentId: string | null
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, societyId },
      select: { id: true, documentId: true },
    });
    if (!entry) return { success: false, error: "Écriture introuvable" };

    const documentResolution = await resolveJournalEntryDocument(societyId, documentId);
    if (documentResolution.error) return { success: false, error: documentResolution.error };
    const linkedDocument = documentResolution.document;

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: { documentId: linkedDocument?.id ?? null },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "JournalEntry",
      entityId: entryId,
      details: {
        action: linkedDocument ? "link_document" : "unlink_document",
        previousDocumentId: entry.documentId,
        documentId: linkedDocument?.id ?? null,
      },
    });

    revalidatePath("/comptabilite");
    revalidatePath("/comptabilite/grand-livre");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[linkJournalEntryDocument]", error);
    return { success: false, error: "Erreur lors de la liaison de la pièce GED" };
  }
}

export async function deleteJournalEntry(
  societyId: string,
  entryId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, societyId },
      select: { id: true, status: true, piece: true, label: true },
    });
    if (!entry) return { success: false, error: "Écriture introuvable" };
    if (entry.status !== "BROUILLON") {
      return { success: false, error: "Seules les écritures en brouillon peuvent être supprimées" };
    }

    await prisma.journalEntry.delete({ where: { id: entryId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "JournalEntry",
      entityId: entryId,
      details: { action: "delete_draft", piece: entry.piece, label: entry.label },
    });

    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteJournalEntry]", error);
    return { success: false, error: "Erreur lors de la suppression de l'écriture" };
  }
}

export async function validateJournalEntry(
  societyId: string,
  entryId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, societyId },
      select: { id: true, status: true },
    });
    if (!entry) return { success: false, error: "Écriture introuvable" };
    if (entry.status !== "BROUILLON") {
      const label = entry.status === "VALIDEE" ? "validée" : "clôturée";
      return { success: false, error: `Cette écriture est déjà ${label} et ne peut plus être modifiée` };
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: { status: "VALIDEE", isValidated: true, validatedById: context.userId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "JournalEntry",
      entityId: entryId,
      details: { action: "validate", status: "VALIDEE" },
    });

    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[validateJournalEntry]", error);
    return { success: false, error: "Erreur lors de la validation de l'écriture" };
  }
}

export async function validateJournalEntries(
  societyId: string,
  entryIds: string[]
): Promise<ActionResult<{ validated: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = validateJournalEntriesSchema.safeParse({ entryIds });
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const uniqueEntryIds = [...new Set(parsed.data.entryIds)];
    const entries = await prisma.journalEntry.findMany({
      where: { societyId, id: { in: uniqueEntryIds } },
      select: {
        id: true,
        status: true,
        lines: { select: { debit: true, credit: true } },
      },
    });

    if (entries.length !== uniqueEntryIds.length) {
      return { success: false, error: "Une ou plusieurs écritures sont introuvables" };
    }

    const notDraft = entries.find((entry) => entry.status !== "BROUILLON");
    if (notDraft) {
      return { success: false, error: "Toutes les écritures doivent être en brouillon pour être validées" };
    }

    const invalidLine = entries.find((entry) => validateDebitCreditLines(entry.lines));
    if (invalidLine) {
      return { success: false, error: "Chaque ligne doit renseigner un débit ou un crédit avant validation" };
    }

    const unbalanced = entries.find((entry) => {
      const totalDebit = roundCents(entry.lines.reduce((sum, line) => sum + line.debit, 0));
      const totalCredit = roundCents(entry.lines.reduce((sum, line) => sum + line.credit, 0));
      return Math.abs(totalDebit - totalCredit) > 0.01;
    });
    if (unbalanced) {
      return { success: false, error: "Chaque écriture doit être équilibrée avant validation" };
    }

    const result = await prisma.journalEntry.updateMany({
      where: { societyId, id: { in: uniqueEntryIds }, status: "BROUILLON" },
      data: { status: "VALIDEE", isValidated: true, validatedById: context.userId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "JournalEntry",
      entityId: societyId,
      details: { action: "bulk_validate", count: result.count, entryIds: uniqueEntryIds },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { validated: result.count } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[validateJournalEntries]", error);
    return { success: false, error: "Erreur lors de la validation des écritures" };
  }
}
