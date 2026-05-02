import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { createAuditLog } from "@/lib/audit";
import {
  isAccountingJournalType,
  normalizeAccountingJournalType,
  type AccountingJournalType,
} from "@/lib/accounting-journals";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const context = await requireActiveSocietyRouteContext();
  if (context instanceof NextResponse) return context;

  const yearParam = req.nextUrl.searchParams.get("year");
  const where: Record<string, unknown> = { societyId: context.societyId };
  if (yearParam) {
    const y = parseInt(yearParam, 10);
    if (isNaN(y) || y < 2000 || y > 2100) {
      return NextResponse.json({ error: "Année invalide" }, { status: 400 });
    }
    where.entryDate = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) };
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    include: { lines: { select: { accountId: true, debit: true, credit: true } } },
    orderBy: { entryDate: "desc" },
  });

  return NextResponse.json(entries);
}

const createEntrySchema = z.object({
  journalType: z
    .string()
    .min(1, "Journal requis")
    .refine(isAccountingJournalType, "Journal comptable non supporté"),
  entryDate: z.string().min(1),
  label: z.string().min(1),
  piece: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        accountId: z.string().cuid(),
        label: z.string().optional().nullable(),
        debit: z.number().min(0),
        credit: z.number().min(0),
      })
    )
    .min(2),
});

export async function POST(req: NextRequest) {
  const context = await requireActiveSocietyRouteContext({ minRole: "COMPTABLE" });
  if (context instanceof NextResponse) return context;

  const body = await req.json();
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((e) => e.message).join(", ") },
      { status: 400 }
    );
  }

  const totalDebit = parsed.data.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = parsed.data.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json(
      { error: "L'écriture n'est pas équilibrée" },
      { status: 400 }
    );
  }

  const accountIds = [...new Set(parsed.data.lines.map((line) => line.accountId))];
  const ownedAccounts = await prisma.accountingAccount.findMany({
    where: {
      id: { in: accountIds },
      societyId: context.societyId,
      isActive: true,
    },
    select: { id: true },
  });
  if (ownedAccounts.length !== accountIds.length) {
    return NextResponse.json(
      { error: "Un ou plusieurs comptes sont invalides pour cette société" },
      { status: 400 }
    );
  }

  const entryDate = new Date(parsed.data.entryDate);
  const journalType = normalizeAccountingJournalType(parsed.data.journalType as AccountingJournalType);
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: {
      societyId: context.societyId,
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
    },
    select: { id: true, isClosed: true },
  });
  if (fiscalYear?.isClosed) {
    return NextResponse.json(
      { error: "Impossible de créer une écriture dans un exercice clôturé" },
      { status: 400 }
    );
  }

  const entry = await prisma.journalEntry.create({
    data: {
      societyId: context.societyId,
      journalType: journalType as never,
      entryDate,
      label: parsed.data.label,
      piece: parsed.data.piece ?? null,
      reference: parsed.data.reference ?? null,
      fiscalYearId: fiscalYear?.id,
      isValidated: false,
      status: "BROUILLON",
      lines: {
        create: parsed.data.lines.map((l) => ({
          accountId: l.accountId,
          label: l.label ?? null,
          debit: l.debit,
          credit: l.credit,
        })),
      },
    },
  });

  await createAuditLog({
    societyId: context.societyId,
    userId: context.userId,
    action: "CREATE",
    entity: "JournalEntry",
    entityId: entry.id,
    details: {
      source: "API",
      journalType,
      piece: parsed.data.piece ?? null,
      label: parsed.data.label,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
