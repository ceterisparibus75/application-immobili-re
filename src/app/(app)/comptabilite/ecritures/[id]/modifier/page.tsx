import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { EditJournalEntryForm } from "./edit-journal-entry-form";

export const metadata = { title: "Modifier une écriture" };

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function EditJournalEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();

  if (!societyId || !session?.user?.id) return null;

  try {
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");
  } catch {
    return null;
  }

  const entry = await prisma.journalEntry.findFirst({
    where: { id, societyId, status: "BROUILLON" },
    include: {
      lines: {
        select: {
          id: true,
          accountId: true,
          label: true,
          debit: true,
          credit: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!entry) notFound();

  return (
    <EditJournalEntryForm
      initialEntry={{
        id: entry.id,
        journalType: entry.journalType,
        entryDate: toInputDate(entry.entryDate),
        piece: entry.piece ?? "",
        label: entry.label,
        fiscalYearId: entry.fiscalYearId ?? "none",
        lines: entry.lines.map((line) => ({
          id: line.id,
          accountId: line.accountId,
          label: line.label ?? "",
          debit: line.debit > 0 ? String(line.debit) : "",
          credit: line.credit > 0 ? String(line.credit) : "",
        })),
      }}
    />
  );
}
