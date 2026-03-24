"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createSepaMandateForTenant, createPayment, cancelMandate } from "@/lib/gocardless-sepa";
import { createSepaMandateSchema, createSepaPaymentSchema } from "@/validations/sepa";
import { ForbiddenError } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

// ── Créer un mandat SEPA pour un locataire ──────────────────

export async function createSepaMandate(
  societyId: string,
  tenantId: string,
  input: unknown
): Promise<ActionResult<{ id: string; mandateReference: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createSepaMandateSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, societyId } });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    const givenName = tenant.firstName ?? tenant.legalRepName ?? "";
    const familyName = tenant.lastName ?? tenant.companyName ?? "";
    const email = tenant.email ?? "";

    if (!email) return { success: false, error: "Le locataire n'a pas d'email" };

    const result = await createSepaMandateForTenant({
      iban: parsed.data.iban,
      accountHolderName: parsed.data.accountHolderName,
      email,
      givenName,
      familyName,
      companyName: tenant.companyName ?? undefined,
    });

    const mandate = await prisma.sepaMandate.create({
      data: {
        societyId,
        tenantId,
        gocardlessId: result.mandateId,
        status: "ACTIVE",
        ibanLast4: result.ibanLast4,
        bankName: result.bankName,
        mandateReference: result.mandateReference,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "SepaMandate",
      entityId: mandate.id,
      details: { tenantId, gocardlessId: result.mandateId },
    });

    revalidatePath(`/locataires/${tenantId}`);
    return { success: true, data: { id: mandate.id, mandateReference: result.mandateReference } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createSepaMandate]", error);
    return { success: false, error: "Erreur lors de la création du mandat SEPA" };
  }
}

// ── Déclencher un prélèvement pour une facture ──────────────

export async function triggerSepaPayment(
  societyId: string,
  input: unknown
): Promise<ActionResult<{ paymentId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createSepaPaymentSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const mandate = await prisma.sepaMandate.findFirst({
      where: { id: parsed.data.mandateId, societyId },
    });
    if (!mandate) return { success: false, error: "Mandat introuvable" };
    if (mandate.status !== "ACTIVE") return { success: false, error: "Mandat non actif" };

    const invoice = await prisma.invoice.findFirst({
      where: { id: parsed.data.invoiceId, societyId },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const payment = await createPayment({
      mandateId: mandate.gocardlessId,
      amountEuros: parsed.data.amount ?? invoice.totalTTC,
      description: parsed.data.description ?? `Facture ${invoice.invoiceNumber}`,
      chargeDate: parsed.data.chargeDate,
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        sepaPaymentId: payment.id,
        sepaStatus: "PENDING_SUBMISSION",
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoice.id,
      details: { action: "sepa_payment_triggered", paymentId: payment.id },
    });

    revalidatePath("/facturation");
    return { success: true, data: { paymentId: payment.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[triggerSepaPayment]", error);
    return { success: false, error: "Erreur lors du déclenchement du prélèvement" };
  }
}

// ── Annuler un mandat ───────────────────────────────────────

export async function cancelSepaMandate(
  societyId: string,
  mandateId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const mandate = await prisma.sepaMandate.findFirst({
      where: { id: mandateId, societyId },
    });
    if (!mandate) return { success: false, error: "Mandat introuvable" };

    await cancelMandate(mandate.gocardlessId);

    await prisma.sepaMandate.update({
      where: { id: mandate.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "SepaMandate",
      entityId: mandate.id,
      details: { action: "cancelled" },
    });

    revalidatePath(`/locataires`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[cancelSepaMandate]", error);
    return { success: false, error: "Erreur lors de l'annulation du mandat" };
  }
}

// ── Lister les mandats d'un locataire ──────────────────────

export async function getSepaMandaltes(
  societyId: string,
  tenantId: string
) {
  const session = await auth();
  if (!session?.user?.id) return null;
  await requireSocietyAccess(session.user.id, societyId);

  return prisma.sepaMandate.findMany({
    where: { societyId, tenantId },
    orderBy: { createdAt: "desc" },
  });
}
