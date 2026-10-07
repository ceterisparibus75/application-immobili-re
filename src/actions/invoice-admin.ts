"use server";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/permissions";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import type { ActionResult } from "@/actions/society";

/**
 * Renumérote manuellement un AVOIR — réservé aux ADMIN_SOCIETE+ pour
 * corriger un doublon ou un numéro cassé par un bug historique de
 * compteur.
 *
 * ⚠️ RESTRICTION FISCALE : les factures (toutes sauf les AVOIRS) sont
 * soumises à l'inaltérabilité des numéros (CGI art. 289 et 242 nonies A).
 * On refuse toute renumérotation sur une pièce qui n'est pas un AVOIR,
 * même par un admin. Les factures doivent conserver leur numéro
 * d'origine ; en cas de doublon réel, émettre un avoir pour annuler
 * l'une des deux factures et réémettre proprement.
 *
 * Validations :
 *  - invoiceType === "AVOIR" (strict)
 *  - Format : lettres/chiffres/tirets/underscores, 1-60 caractères
 *  - Unicité société + invoiceNumber (contrainte @@unique côté schéma)
 *  - Pas de changement si l'invoice est en BROUILLON (invoiceNumber=null)
 */
export async function renumberInvoice(
  societyId: string,
  invoiceId: string,
  newInvoiceNumber: string,
): Promise<ActionResult<{ previousNumber: string | null; newNumber: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const trimmed = newInvoiceNumber.trim();
    if (!trimmed) {
      return { success: false, error: "Le numéro ne peut pas être vide" };
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return {
        success: false,
        error: "Format invalide — uniquement lettres, chiffres, tirets et underscores sont autorisés.",
      };
    }
    if (trimmed.length > 60) {
      return { success: false, error: "Numéro trop long (max 60 caractères)" };
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: { id: true, invoiceNumber: true, status: true, tenantId: true, invoiceType: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.invoiceType !== "AVOIR") {
      return {
        success: false,
        error:
          "Interdit : les numéros de facture sont inaltérables (CGI art. 289). Seuls les avoirs peuvent être renumérotés. Pour corriger une facture, émettez un avoir pour l'annuler et réémettez-la proprement.",
      };
    }
    if (invoice.status === "BROUILLON") {
      return {
        success: false,
        error: "Un brouillon n'a pas encore de numéro — validez-le d'abord.",
      };
    }
    if (invoice.invoiceNumber === trimmed) {
      return { success: false, error: "Le numéro est déjà celui actuellement attribué" };
    }

    // Vérifier préalable qu'aucune autre facture de la société ne porte déjà
    // ce numéro — la contrainte unique le ferait aussi, mais le message
    // d'erreur serait moins lisible.
    const collision = await prisma.invoice.findFirst({
      where: {
        societyId,
        invoiceNumber: trimmed,
        id: { not: invoiceId },
      },
      select: { id: true, invoiceType: true },
    });
    if (collision) {
      return {
        success: false,
        error: `Ce numéro est déjà utilisé par une autre pièce (type ${collision.invoiceType}). Choisissez un autre numéro.`,
      };
    }

    const previousNumber = invoice.invoiceNumber;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { invoiceNumber: trimmed },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: {
        action: "renumber",
        previousNumber,
        newNumber: trimmed,
        invoiceType: invoice.invoiceType,
      },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    if (invoice.tenantId) revalidatePath(`/locataires/${invoice.tenantId}`);

    return { success: true, data: { previousNumber, newNumber: trimmed } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[renumberInvoice]", error);
    return { success: false, error: "Erreur lors de la renumérotation" };
  }
}
