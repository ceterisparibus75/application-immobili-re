"use server";

import type { ActionResult } from "@/actions/society";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  letterEntriesSchema,
  unletterEntriesSchema,
  getUnletteredEntriesSchema,
  getLetteredGroupsSchema,
  getLetteringSuggestionsSchema,
} from "@/validations/lettering";

export type LetteredGroup = {
  letteringCode: string;
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  firstEntryDate: Date;
  lastEntryDate: Date;
  letteredAt: Date | null;
  pieces: string[];
};

export type LetteringSuggestion = {
  lineIds: string[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
  reason: string;
  lines: {
    id: string;
    debit: number;
    credit: number;
    label: string | null;
    entryDate: Date;
    piece: string | null;
    reference: string | null;
    entryLabel: string;
  }[];
};

type SuggestionEntryLine = {
  id: string;
  debit: number;
  credit: number;
  label: string | null;
  journalEntry: {
    entryDate: Date;
    piece: string | null;
    reference: string | null;
    label: string;
  };
};

type CreditCandidate = {
  line: SuggestionEntryLine;
  used: boolean;
};

type DebitCandidate = {
  line: SuggestionEntryLine;
  used: boolean;
};

type ScoredCreditCandidate = CreditCandidate & {
  sharedReference: boolean;
  relatedLabels: boolean;
  closeDate: boolean;
  score: number;
};

type ScoredDebitCandidate = DebitCandidate & {
  sharedReference: boolean;
  relatedLabels: boolean;
  closeDate: boolean;
  score: number;
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeMatchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasSharedReference(
  debitLine: { label: string | null; journalEntry: { piece: string | null; reference: string | null; label: string } },
  creditLine: { label: string | null; journalEntry: { piece: string | null; reference: string | null; label: string } }
): boolean {
  const debitRefs = [
    debitLine.journalEntry.reference,
    debitLine.journalEntry.piece,
  ].map(normalizeMatchText).filter(Boolean);
  const creditRefs = [
    creditLine.journalEntry.reference,
    creditLine.journalEntry.piece,
  ].map(normalizeMatchText).filter(Boolean);

  return debitRefs.some((debitRef) =>
    creditRefs.includes(debitRef) ||
    normalizeMatchText(creditLine.label).includes(debitRef) ||
    normalizeMatchText(creditLine.journalEntry.label).includes(debitRef)
  );
}

function labelsLookRelated(
  debitLine: { label: string | null; journalEntry: { piece: string | null; label: string } },
  creditLine: { label: string | null; journalEntry: { label: string } }
): boolean {
  const debitPiece = normalizeMatchText(debitLine.journalEntry.piece);
  if (debitPiece && (normalizeMatchText(creditLine.label).includes(debitPiece) || normalizeMatchText(creditLine.journalEntry.label).includes(debitPiece))) {
    return true;
  }

  const debitTokens = new Set([
    ...normalizeMatchText(debitLine.label).split(" "),
    ...normalizeMatchText(debitLine.journalEntry.label).split(" "),
  ].filter((token) => token.length >= 4));
  const creditTokens = new Set([
    ...normalizeMatchText(creditLine.label).split(" "),
    ...normalizeMatchText(creditLine.journalEntry.label).split(" "),
  ].filter((token) => token.length >= 4));

  return [...debitTokens].some((token) => creditTokens.has(token));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function buildSuggestionReason(matches: { sharedReference: boolean; relatedLabels: boolean; closeDate: boolean }): string {
  const reasons = [
    matches.sharedReference ? "Référence commune" : null,
    matches.relatedLabels ? "libellés proches" : null,
    matches.closeDate ? "date proche" : null,
  ].filter((reason): reason is string => Boolean(reason));

  return reasons.length > 0 ? reasons.join(", ") : "Montants identiques";
}

function scoreCreditCandidate(debitLine: SuggestionEntryLine, creditLine: SuggestionEntryLine) {
  const sharedReference = hasSharedReference(debitLine, creditLine);
  const relatedLabels = labelsLookRelated(debitLine, creditLine);
  const closeDate = daysBetween(debitLine.journalEntry.entryDate, creditLine.journalEntry.entryDate) <= 15;
  const score =
    100 +
    (sharedReference ? 50 : 0) +
    (relatedLabels ? 20 : 0) +
    (closeDate ? 10 : 0) -
    Math.min(daysBetween(debitLine.journalEntry.entryDate, creditLine.journalEntry.entryDate), 365) / 100;
  return { sharedReference, relatedLabels, closeDate, score };
}

function findCreditCombination(debitLine: SuggestionEntryLine, candidates: CreditCandidate[]): ScoredCreditCandidate[] | null {
  const target = roundCents(debitLine.debit);
  const ranked: ScoredCreditCandidate[] = candidates
    .filter((candidate) => !candidate.used && candidate.line.credit > 0 && candidate.line.credit < target + 0.01)
    .map((candidate) => ({ ...candidate, ...scoreCreditCandidate(debitLine, candidate.line) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  let best: ScoredCreditCandidate[] | null = null;

  function search(index: number, selected: ScoredCreditCandidate[], total: number): boolean {
    const roundedTotal = roundCents(total);
    if (selected.length >= 2 && Math.abs(roundedTotal - target) <= 0.01) {
      best = selected;
      return true;
    }
    if (selected.length >= 4 || roundedTotal > target + 0.01) return false;

    for (let i = index; i < ranked.length; i += 1) {
      if (search(i + 1, [...selected, ranked[i]], roundedTotal + ranked[i].line.credit)) return true;
    }
    return false;
  }

  search(0, [], 0);
  return best;
}

function findDebitCombination(creditLine: SuggestionEntryLine, candidates: DebitCandidate[]): ScoredDebitCandidate[] | null {
  const target = roundCents(creditLine.credit);
  const ranked: ScoredDebitCandidate[] = candidates
    .filter((candidate) => !candidate.used && candidate.line.debit > 0 && candidate.line.debit < target + 0.01)
    .map((candidate) => ({ ...candidate, ...scoreCreditCandidate(candidate.line, creditLine) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  let best: ScoredDebitCandidate[] | null = null;

  function search(index: number, selected: ScoredDebitCandidate[], total: number): boolean {
    const roundedTotal = roundCents(total);
    if (selected.length >= 2 && Math.abs(roundedTotal - target) <= 0.01) {
      best = selected;
      return true;
    }
    if (selected.length >= 4 || roundedTotal > target + 0.01) return false;

    for (let i = index; i < ranked.length; i += 1) {
      if (search(i + 1, [...selected, ranked[i]], roundedTotal + ranked[i].line.debit)) return true;
    }
    return false;
  }

  search(0, [], 0);
  return best;
}

function markLineUsed(candidates: Array<{ line: { id: string }; used: boolean }>, lineId: string): void {
  const candidate = candidates.find((item) => item.line.id === lineId);
  if (candidate) candidate.used = true;
}

function toSuggestionLine(line: SuggestionEntryLine): LetteringSuggestion["lines"][number] {
  return {
    id: line.id,
    debit: line.debit,
    credit: line.credit,
    label: line.label,
    entryDate: line.journalEntry.entryDate,
    piece: line.journalEntry.piece,
    reference: line.journalEntry.reference ?? null,
    entryLabel: line.journalEntry.label,
  };
}
/**
 * Genere le prochain code de lettrage pour une societe.
 * Sequence : AA, AB, ..., AZ, BA, BB, ..., ZZ
 */
export async function getNextLetteringCode(
  societyId: string
): Promise<ActionResult<{ code: string }>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    // Trouver le dernier code de lettrage utilise pour cette societe, champs legacy inclus.
    const letteredLines = await prisma.journalEntryLine.findMany({
      where: {
        OR: [
          { letteringCode: { not: null } },
          { lettrage: { not: null } },
        ],
        journalEntry: { societyId },
      },
      select: { letteringCode: true, lettrage: true },
    });

    const lastCode = letteredLines
      .flatMap((line) => [line.letteringCode, line.lettrage])
      .filter((code): code is string => Boolean(code))
      .sort((a, b) => (a.length === b.length ? a.localeCompare(b) : a.length - b.length))
      .at(-1);

    if (!lastCode) {
      return { success: true, data: { code: "AA" } };
    }

    const nextCode = incrementLetteringCode(lastCode);
    return { success: true, data: { code: nextCode } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifie" };
    }
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
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

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
        lettrage: true,
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
    const alreadyLettered = lines.filter((l) => l.letteringCode !== null || l.lettrage !== null);
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
        lettrage: code,
        letteredAt: now,
      },
    });

    // Audit log
    await createAuditLog({
      societyId,
      userId: context.userId,
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
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifie" };
    }
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
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

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
        OR: [
          { letteringCode: parsed.data.letteringCode },
          { lettrage: parsed.data.letteringCode },
        ],
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
        OR: [
          { letteringCode: parsed.data.letteringCode },
          { lettrage: parsed.data.letteringCode },
        ],
        journalEntry: { societyId },
      },
      data: {
        letteringCode: null,
        lettrage: null,
        letteredAt: null,
      },
    });

    // Audit log
    await createAuditLog({
      societyId,
      userId: context.userId,
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
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifie" };
    }
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
    await requireSocietyActionContext(societyId, "COMPTABLE");

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
        lettrage: null,
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
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifie" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[getUnletteredEntries]", error);
    return { success: false, error: "Erreur lors de la recuperation des lignes non lettrees" };
  }
}

export async function getLetteredGroups(
  societyId: string,
  accountId: string
): Promise<ActionResult<{ groups: LetteredGroup[] }>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = getLetteredGroupsSchema.safeParse({ accountId });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: parsed.data.accountId,
        OR: [
          { letteringCode: { not: null } },
          { lettrage: { not: null } },
        ],
        journalEntry: { societyId },
      },
      include: {
        journalEntry: {
          select: {
            entryDate: true,
            piece: true,
            reference: true,
            label: true,
          },
        },
      },
      orderBy: [
        { letteringCode: "asc" },
        { journalEntry: { entryDate: "asc" } },
      ],
    });

    const groups = new Map<string, LetteredGroup>();
    for (const line of lines) {
      const letteringCode = line.letteringCode ?? line.lettrage;
      if (!letteringCode) continue;
      const existing = groups.get(letteringCode);
      if (existing) {
        existing.lineCount += 1;
        existing.totalDebit = roundCents(existing.totalDebit + line.debit);
        existing.totalCredit = roundCents(existing.totalCredit + line.credit);
        if (line.journalEntry.entryDate < existing.firstEntryDate) existing.firstEntryDate = line.journalEntry.entryDate;
        if (line.journalEntry.entryDate > existing.lastEntryDate) existing.lastEntryDate = line.journalEntry.entryDate;
        if (line.letteredAt && (!existing.letteredAt || line.letteredAt > existing.letteredAt)) existing.letteredAt = line.letteredAt;
        if (line.journalEntry.piece && !existing.pieces.includes(line.journalEntry.piece)) existing.pieces.push(line.journalEntry.piece);
        continue;
      }

      groups.set(letteringCode, {
        letteringCode,
        lineCount: 1,
        totalDebit: roundCents(line.debit),
        totalCredit: roundCents(line.credit),
        firstEntryDate: line.journalEntry.entryDate,
        lastEntryDate: line.journalEntry.entryDate,
        letteredAt: line.letteredAt,
        pieces: line.journalEntry.piece ? [line.journalEntry.piece] : [],
      });
    }

    return { success: true, data: { groups: [...groups.values()] } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifie" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[getLetteredGroups]", error);
    return { success: false, error: "Erreur lors de la recuperation des groupes lettres" };
  }
}

export async function getLetteringSuggestions(
  societyId: string,
  accountId: string
): Promise<ActionResult<{ suggestions: LetteringSuggestion[] }>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = getLetteringSuggestionsSchema.safeParse({ accountId });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: parsed.data.accountId,
        letteringCode: null,
        lettrage: null,
        journalEntry: { societyId },
      },
      include: {
        journalEntry: {
          select: {
            entryDate: true,
            piece: true,
            reference: true,
            label: true,
          },
        },
      },
      orderBy: {
        journalEntry: { entryDate: "asc" },
      },
    });

    const availableCredits = lines
      .filter((line) => line.credit > 0 && line.debit === 0)
      .map((line) => ({ line, used: false }));
    const availableDebits = lines
      .filter((line) => line.debit > 0 && line.credit === 0)
      .map((line) => ({ line, used: false }));
    const suggestions: LetteringSuggestion[] = [];

    for (const debitCandidate of availableDebits) {
      if (debitCandidate.used) continue;
      const debitLine = debitCandidate.line;
      const match = availableCredits
        .filter((candidate) => !candidate.used && Math.abs(roundCents(debitLine.debit - candidate.line.credit)) <= 0.01)
        .map((candidate) => {
          return { ...candidate, ...scoreCreditCandidate(debitLine, candidate.line) };
        })
        .sort((a, b) => b.score - a.score)[0];
      if (match) {
        markLineUsed(availableDebits, debitLine.id);
        markLineUsed(availableCredits, match.line.id);

        const suggestionLines = [debitLine, match.line].map(toSuggestionLine);

        suggestions.push({
          lineIds: suggestionLines.map((line) => line.id),
          totalDebit: roundCents(debitLine.debit),
          totalCredit: roundCents(match.line.credit),
          difference: 0,
          reason: buildSuggestionReason(match),
          lines: suggestionLines,
        });
        continue;
      }

      const combination = findCreditCombination(debitLine, availableCredits);
      if (!combination) continue;
      markLineUsed(availableDebits, debitLine.id);
      combination.forEach((candidate) => {
        markLineUsed(availableCredits, candidate.line.id);
      });

      const suggestionLines = [debitLine, ...combination.map((candidate) => candidate.line)].map(toSuggestionLine);
      const totalCredit = roundCents(combination.reduce((sum, candidate) => sum + candidate.line.credit, 0));
      suggestions.push({
        lineIds: suggestionLines.map((line) => line.id),
        totalDebit: roundCents(debitLine.debit),
        totalCredit,
        difference: roundCents(Math.abs(debitLine.debit - totalCredit)),
        reason: "Paiements cumulés",
        lines: suggestionLines,
      });
    }

    for (const creditCandidate of availableCredits) {
      if (creditCandidate.used) continue;
      const combination = findDebitCombination(creditCandidate.line, availableDebits);
      if (!combination) continue;

      markLineUsed(availableCredits, creditCandidate.line.id);
      combination.forEach((candidate) => {
        markLineUsed(availableDebits, candidate.line.id);
      });

      const suggestionLines = [...combination.map((candidate) => candidate.line), creditCandidate.line].map(toSuggestionLine);
      const totalDebit = roundCents(combination.reduce((sum, candidate) => sum + candidate.line.debit, 0));
      suggestions.push({
        lineIds: suggestionLines.map((line) => line.id),
        totalDebit,
        totalCredit: roundCents(creditCandidate.line.credit),
        difference: roundCents(Math.abs(totalDebit - creditCandidate.line.credit)),
        reason: "Factures cumulées",
        lines: suggestionLines,
      });
    }

    return { success: true, data: { suggestions } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifie" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[getLetteringSuggestions]", error);
    return { success: false, error: "Erreur lors du calcul des suggestions de lettrage" };
  }
}
