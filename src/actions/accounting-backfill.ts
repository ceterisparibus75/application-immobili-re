"use server";

import { revalidatePath } from "next/cache";
import type { InvoiceType } from "@/generated/prisma/client";
import { createCustomerInvoiceJournalEntry } from "@/lib/accounting-automation";
import { createAuditLog } from "@/lib/audit";
import { requireSocietyActionContext } from "@/lib/action-society";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "@/actions/society";

export type BackfillResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
};

/**
 * Rattrape les écritures comptables manquantes pour un type de facture donné.
 *
 * Sûr par construction :
 *  - `createCustomerInvoiceJournalEntry` est idempotent (il recherche d'abord
 *    `reference = "invoice:{invoiceId}:validation"` et renvoie l'ID existant),
 *    on peut donc l'invoquer sans crainte de doublon.
 *  - Les factures sans numéro ou qui échouent à l'équilibrage ne génèrent
 *    aucune écriture — elles sont comptabilisées comme "failed" avec un motif.
 */
async function backfillMissingJournalEntries(
  societyId: string,
  invoiceType: InvoiceType,
  source: "backfill_avoir" | "backfill_quittance"
): Promise<ActionResult<BackfillResult>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    // Récupère tous les IDs d'écritures de vente existantes pour cette société,
    // puis identifie les factures du type demandé qui n'ont pas de JournalEntry
    // rattachée via la clé `reference = "invoice:{invoiceId}:validation"`.
    const existingEntries = await prisma.journalEntry.findMany({
      where: {
        societyId,
        reference: { startsWith: "invoice:" },
      },
      select: { reference: true },
    });

    const linkedInvoiceIds = new Set<string>();
    for (const entry of existingEntries) {
      if (!entry.reference) continue;
      // Format attendu : "invoice:<id>:validation"
      const match = entry.reference.match(/^invoice:(.+):validation$/);
      if (match) linkedInvoiceIds.add(match[1]);
    }

    const candidates = await prisma.invoice.findMany({
      where: {
        societyId,
        invoiceType,
        invoiceNumber: { not: null },
      },
      select: { id: true, invoiceNumber: true },
    });

    const missing = candidates.filter((invoice) => !linkedInvoiceIds.has(invoice.id));

    const result: BackfillResult = {
      processed: missing.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const invoice of missing) {
      try {
        const entryId = await createCustomerInvoiceJournalEntry(
          prisma,
          societyId,
          invoice.id
        );
        if (entryId) {
          result.succeeded += 1;
          await createAuditLog({
            societyId,
            userId: context.userId,
            action: "CREATE",
            entity: "JournalEntry",
            entityId: entryId,
            details: {
              source,
              avoirId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              invoiceType,
            },
          });
        } else {
          result.failed += 1;
          result.errors.push(
            `Facture ${invoice.invoiceNumber ?? invoice.id} : écriture non générée (facture incomplète ou lignes déséquilibrées)`
          );
        }
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(
          `Facture ${invoice.invoiceNumber ?? invoice.id} : ${message}`
        );
        console.error("[accounting-backfill]", invoice.id, error);
      }
    }

    revalidatePath("/comptabilite");
    revalidatePath("/facturation");

    return { success: true, data: result };
  } catch (error) {
    console.error("[backfillMissingJournalEntries]", error);
    const message = error instanceof Error ? error.message : "Erreur lors du rattrapage";
    return { success: false, error: message };
  }
}

export async function backfillMissingAvoirJournalEntries(
  societyId: string
): Promise<ActionResult<BackfillResult>> {
  return backfillMissingJournalEntries(societyId, "AVOIR", "backfill_avoir");
}

export async function backfillMissingQuittanceJournalEntries(
  societyId: string
): Promise<ActionResult<BackfillResult>> {
  return backfillMissingJournalEntries(societyId, "QUITTANCE", "backfill_quittance");
}
