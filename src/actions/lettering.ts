"use server";

import type { ActionResult } from "@/actions/society";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  letterEntriesSchema,
  unletterEntriesSchema,
  getUnletteredEntriesSchema,
} from "@/validations/lettering";
/**
 * Genere le prochain code de lettrage pour une societe.
 * Sequence : AA, AB, ..., AZ, BA, BB, ..., ZZ
 */
export async function getNextLetteringCode(
  societyId: string
): Promise<ActionResult<{ code: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifie" };
    }

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // Trouver le dernier code de lettrage utilise pour cette societe
    const lastLettered = await prisma.journalEntryLine.findFirst({
      where: {
        letteringCode: { not: null },
        journalEntry: { societyId },
      },
      orderBy: { letteringCode: "desc" },
      select: { letteringCode: true },
    });

    if (!lastLettered?.letteringCode) {
      return { success: true, data: { code: "AA" } };
    }

    const code = lastLettered.letteringCode;
    const nextCode = incrementLetteringCode(code);
    return { success: true, data: { code: nextCode } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[getNextLetteringCode]", error);
    return { success: false, error: "Erreur lors de la generation du code de lettrage" };
  }
}

/**
 * Incremente un code de lettrage : AA -> AB, AZ -> BA, ZZ -> AAA
 */
function incrementLetteringCode(code: string): string {
  const chars = code.split("");
  let i = chars.length - 1;

  while (i >= 0) {
    if (chars[i] === "Z") {
      chars[i] = "A";
      i--;
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
  }

  // Tous les caracteres etaient Z -> ajouter un caractere
  return "A" + chars.join("");
}
/**
 * Lettre un groupe de lignes d ecritures comptables.
 * Verifie que la somme des debits = somme des credits avant de lettrer.
 */
export async function letterEntries(
  societyId: string,
  lineIds: string[]
): Promise<ActionResult<{ letteringCode: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifie" };
    }

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // Validation Zod
    const parsed = letterEntriesSchema.safeParse({ lineIds });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    // Recuperer les lignes avec verification que toutes appartiennent a la societe
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        id: { in: parsed.data.lineIds },
        journalEntry: { societyId },
      },
      select: {
        id: true,
        debit: true,
        credit: true,
        letteringCode: true,
        accountId: true,
      },
    });

    // Verifier que toutes les lignes ont ete trouvees
    if (lines.length !== parsed.data.lineIds.length) {
      return {
        success: false,
        error: "Certaines lignes sont introuvables ou n appartiennent pas a cette societe",
      };
    }

    // Verifier qu aucune ligne n est deja lettree
    const alreadyLettered = lines.filter((l) => l.letteringCode !== null);
    if (alreadyLettered.length > 0) {
      return {
        success: false,
        error: `${alreadyLettered.length} ligne(s) deja lettree(s). Delettrez-les d abord.`,
      };
    }

    // Verifier l equilibre debit = credit
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        error: `Desequilibre : total debit (${totalDebit.toFixed(2)}) != total credit (${totalCredit.toFixed(2)}). Le lettrage exige un equilibre parfait.`,
      };
    }

    // Generer le prochain code de lettrage
    const codeResult = await getNextLetteringCode(societyId);
    if (!codeResult.success || !codeResult.data) {
      return { success: false, error: "Impossible de generer le code de lettrage" };
    }
    const code = codeResult.data.code;
    const now = new Date();

    // Appliquer le lettrage
    await prisma.journalEntryLine.updateMany({
      where: { id: { in: parsed.data.lineIds } },
      data: {
        letteringCode: code,
        letteredAt: now,
      },
    });

    // Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "JournalEntryLine",
      entityId: code,
      details: {
        operation: "lettrage",
        letteringCode: code,
        lineCount: lines.length,
        totalDebit,
        totalCredit,
      },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { letteringCode: code } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[letterEntries]", error);
    return { success: false, error: "Erreur lors du lettrage" };
  }
}
/**
 * Supprime le lettrage d un groupe de lignes identifie par son code.
 */
export async function unletterEntries(
  societyId: string,
  letteringCode: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifie" };
    }

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // Validation Zod
    const parsed = unletterEntriesSchema.safeParse({ letteringCode });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    // Verifier que des lignes existent avec ce code dans cette societe
    const existingLines = await prisma.journalEntryLine.findMany({
      where: {
        letteringCode: parsed.data.letteringCode,
        journalEntry: { societyId },
      },
      select: { id: true },
    });

    if (existingLines.length === 0) {
      return {
        success: false,
        error: `Aucune ligne trouvee avec le code de lettrage ${parsed.data.letteringCode}`,
      };
    }

    // Supprimer le lettrage
    await prisma.journalEntryLine.updateMany({
      where: {
        letteringCode: parsed.data.letteringCode,
        journalEntry: { societyId },
      },
      data: {
        letteringCode: null,
        letteredAt: null,
      },
    });

    // Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "JournalEntryLine",
      entityId: parsed.data.letteringCode,
      details: {
        operation: "delettrage",
        letteringCode: parsed.data.letteringCode,
        lineCount: existingLines.length,
      },
    });

    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[unletterEntries]", error);
    return { success: false, error: "Erreur lors du delettrage" };
  }
}
/**
 * Liste les lignes non lettrees d un compte comptable.
 */
export async function getUnletteredEntries(
  societyId: string,
  accountId: string
): Promise<
  ActionResult<{
    lines: {
      id: string;
      debit: number;
      credit: number;
      label: string | null;
      entryDate: Date;
      piece: string | null;
      entryLabel: string;
    }[];
  }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifie" };
    }

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // Validation Zod
    const parsed = getUnletteredEntriesSchema.safeParse({ accountId });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    // Recuperer les lignes non lettrees pour ce compte dans cette societe
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: parsed.data.accountId,
        letteringCode: null,
        journalEntry: { societyId },
      },
      include: {
        journalEntry: {
          select: {
            entryDate: true,
            piece: true,
            label: true,
          },
        },
      },
      orderBy: {
        journalEntry: { entryDate: "asc" },
      },
    });

    return {
      success: true,
      data: {
        lines: lines.map((l) => ({
          id: l.id,
          debit: l.debit,
          credit: l.credit,
          label: l.label,
          entryDate: l.journalEntry.entryDate,
          piece: l.journalEntry.piece,
          entryLabel: l.journalEntry.label,
        })),
      },
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[getUnletteredEntries]", error);
    return { success: false, error: "Erreur lors de la recuperation des lignes non lettrees" };
  }
}
