import type { Prisma } from "@/generated/prisma/client";

type FiscalYearClient = Pick<Prisma.TransactionClient, "fiscalYear">;

export class ClosedFiscalYearError extends Error {
  constructor() {
    super("Impossible de créer une écriture dans un exercice clôturé");
    this.name = "ClosedFiscalYearError";
  }
}

export async function resolveOpenFiscalYearIdForDate(
  client: FiscalYearClient,
  societyId: string,
  entryDate: Date
): Promise<string | null> {
  const fiscalYear = await client.fiscalYear.findFirst({
    where: {
      societyId,
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
    },
    select: { id: true, isClosed: true },
  });

  if (fiscalYear?.isClosed) throw new ClosedFiscalYearError();
  return fiscalYear?.id ?? null;
}
