import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    await requireSocietyAccess(session.user.id, societyId);
  } catch {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const yearParam = req.nextUrl.searchParams.get("year");
  const where: Record<string, unknown> = { societyId };
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
  journalType: z.enum(["VENTES", "BANQUE", "OPERATIONS_DIVERSES"]),
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
  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
  } catch {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

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

  const entry = await prisma.journalEntry.create({
    data: {
      societyId,
      journalType: parsed.data.journalType,
      entryDate: new Date(parsed.data.entryDate),
      label: parsed.data.label,
      piece: parsed.data.piece ?? null,
      reference: parsed.data.reference ?? null,
      isValidated: false,
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

  return NextResponse.json(entry, { status: 201 });
}
