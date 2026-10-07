import type { Prisma } from "@/generated/prisma/client";

type FiscalYearClient = Pick<Prisma.TransactionClient, "fiscalYear">;

export class ClosedFiscalYearError extends Error {
  constructor() {
    super("Impossible de créer une écriture dans un exercice clôturé");
    this.name = "ClosedFiscalYearError";
  }
}

/**
 * Levée par `requireOpenFiscalYearIdForDate` quand aucun exercice fiscal
 * ouvert ne couvre la date demandée.
 *
 * Les appelants (server actions) sont attendus pour catcher cette erreur
 * et renvoyer un `ActionResult.error` explicite au lieu de la laisser
 * remonter en 500. Message prêt à être affiché à l'utilisateur.
 */
export class NoOpenFiscalYearError extends Error {
  constructor(public readonly entryDate: Date) {
    const dateStr = entryDate.toLocaleDateString("fr-FR");
    super(
      `Aucun exercice fiscal n'est ouvert pour la date ${dateStr}. Créez l'exercice avant de passer cette écriture.`
    );
    this.name = "NoOpenFiscalYearError";
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

/**
 * Variante stricte : throw `NoOpenFiscalYearError` si aucun exercice fiscal
 * ouvert ne couvre la date. Levée aussi si l'exercice trouvé est clôturé
 * (via `ClosedFiscalYearError`, propagée par resolveOpenFiscalYearIdForDate).
 *
 * À utiliser par tous les helpers qui créent une JournalEntry et qui doivent
 * garantir un fiscalYearId non-null (préparation de la contrainte NOT NULL
 * sur `JournalEntry.fiscalYearId`).
 */
export async function requireOpenFiscalYearIdForDate(
  client: FiscalYearClient,
  societyId: string,
  entryDate: Date
): Promise<string> {
  const id = await resolveOpenFiscalYearIdForDate(client, societyId, entryDate);
  if (!id) throw new NoOpenFiscalYearError(entryDate);
  return id;
}
