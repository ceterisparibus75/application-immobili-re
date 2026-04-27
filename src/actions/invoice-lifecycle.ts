"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  recordPaymentSchema,
  type RecordPaymentInput,
} from "@/validations/invoice";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { InvoiceStatus } from "@/generated/prisma/client";
import { decrypt } from "@/lib/encryption";
import { sendInvoiceEmail } from "@/lib/email";
import { buildStorageFileName } from "@/lib/storage-path";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { env } from "@/lib/env";
import { getNextInvoiceNumber } from "./invoice-shared";

// Numéro alloué à la validation, pas à la création du brouillon.

export async function recordPayment(
  societyId: string,
  input: RecordPaymentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: parsed.data.invoiceId, societyId },
      include: { payments: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (["BROUILLON", "ANNULEE"].includes(invoice.status)) {
      return { success: false, error: "Impossible d'enregistrer un paiement sur une facture en brouillon ou annulée" };
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: parsed.data.invoiceId,
        amount: parsed.data.amount,
        paidAt: new Date(parsed.data.paidAt),
        method: parsed.data.method ?? null,
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    const totalPaid =
      invoice.payments.reduce((s, p) => s + p.amount, 0) + parsed.data.amount;
    let newStatus: InvoiceStatus = invoice.status;
    if (totalPaid >= invoice.totalTTC) {
      newStatus = "PAYE";
    } else if (totalPaid > 0) {
      newStatus = "PARTIELLEMENT_PAYE";
    }

    await prisma.invoice.update({
      where: { id: parsed.data.invoiceId },
      data: { status: newStatus },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: parsed.data.invoiceId,
      details: { paymentAmount: parsed.data.amount, newStatus },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${parsed.data.invoiceId}`);
    revalidatePath("/locataires");
    if (invoice.tenantId) {
      revalidatePath(`/locataires/${invoice.tenantId}`);
    }

    if (newStatus === "PAYE" && invoice.invoiceType === "APPEL_LOYER") {
      generateAndSendQuittance(societyId, parsed.data.invoiceId, new Date(parsed.data.paidAt)).catch((err) => {
        console.error("[recordPayment] Quittance auto échouée:", err);
      });
    }

    return { success: true, data: { id: payment.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[recordPayment]", error);
    return { success: false, error: "Erreur lors de l'enregistrement du paiement" };
  }
}

/**
 * Génère automatiquement une quittance depuis un appel de loyer payé,
 * envoie par email et dépose dans l'espace locataire.
 * Appelée après un rapprochement bancaire réussi.
 */
export async function generateAndSendQuittance(
  societyId: string,
  paidInvoiceId: string,
  paymentDate: Date
): Promise<ActionResult<{ quittanceId: string }>> {
  try {
    const paidInvoice = await prisma.invoice.findFirst({
      where: { id: paidInvoiceId, societyId },
      include: {
        lines: true,
        tenant: true,
        lease: { select: { id: true, lot: { select: { number: true, building: { select: { name: true, addressLine1: true } } } } } },
        payments: { orderBy: { paidAt: "asc" } },
        society: true,
      },
    });
    if (!paidInvoice) return { success: false, error: "Facture introuvable" };
    if (paidInvoice.invoiceType !== "APPEL_LOYER") return { success: false, error: "Seuls les appels de loyer génèrent des quittances" };

    const existingQuittance = await prisma.invoice.findFirst({
      where: {
        societyId,
        tenantId: paidInvoice.tenantId,
        invoiceType: "QUITTANCE",
        periodStart: paidInvoice.periodStart,
        periodEnd: paidInvoice.periodEnd,
      },
    });
    if (existingQuittance) return { success: true, data: { quittanceId: existingQuittance.id } };

    const quittance = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await getNextInvoiceNumber(societyId, tx);
      return tx.invoice.create({
        data: {
          societyId,
          tenantId: paidInvoice.tenantId,
          leaseId: paidInvoice.leaseId,
          invoiceNumber,
          invoiceType: "QUITTANCE",
          status: "VALIDEE",
          issueDate: new Date(),
          dueDate: paymentDate,
          periodStart: paidInvoice.periodStart,
          periodEnd: paidInvoice.periodEnd,
          totalHT: paidInvoice.totalHT,
          totalVAT: paidInvoice.totalVAT,
          totalTTC: paidInvoice.totalTTC,
          lines: {
            create: paidInvoice.lines.map((l) => ({
              label: l.label,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              vatRate: l.vatRate,
              totalHT: l.totalHT,
              totalVAT: l.totalVAT,
              totalTTC: l.totalTTC,
            })),
          },
        },
      });
    });

    await prisma.payment.create({
      data: {
        invoiceId: quittance.id,
        amount: paidInvoice.totalTTC,
        paidAt: paymentDate,
        method: "virement",
      },
    });
    await prisma.invoice.update({
      where: { id: quittance.id },
      data: { status: "PAYE" },
    });

    generateQuittancePdfAndSend(societyId, quittance.id).catch((err) => {
      console.error("[generateAndSendQuittance] Envoi email/PDF échoué:", err);
    });

    revalidatePath("/facturation");
    revalidatePath("/locataires");
    if (paidInvoice.tenantId) {
      revalidatePath(`/locataires/${paidInvoice.tenantId}`);
    }

    return { success: true, data: { quittanceId: quittance.id } };
  } catch (error) {
    console.error("[generateAndSendQuittance]", error);
    return { success: false, error: "Erreur lors de la génération de la quittance" };
  }
}

/**
 * Génère le PDF de la quittance, l'envoie par email et le dépose dans Supabase.
 * Exécuté en arrière-plan (non bloquant pour le rapprochement).
 */
async function generateQuittancePdfAndSend(
  societyId: string,
  quittanceId: string
) {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { InvoicePdf } = await import("@/lib/invoice-pdf");
  const { sendReceiptEmail } = await import("@/lib/email");
  const { getAllEmailCopyBcc } = await import("@/lib/email-copy");
  const { createClient } = await import("@supabase/supabase-js");
  const React = (await import("react")).default;

  const quittance = await prisma.invoice.findFirst({
    where: { id: quittanceId },
    include: {
      lines: true,
      payments: { orderBy: { paidAt: "asc" } },
      society: true,
      tenant: true,
      lease: { select: { lot: { select: { number: true, building: { select: { name: true, addressLine1: true } } } } } },
    },
  });
  if (!quittance) return;

  const soc = quittance.society;
  const tenant = quittance.tenant;
  const to = tenant.billingEmail || tenant.email;
  if (!to) return;

  let iban: string | null = null;
  let bic: string | null = null;
  try {
    if (soc?.ibanEncrypted) iban = decrypt(soc.ibanEncrypted);
    if (soc?.bicEncrypted) bic = decrypt(soc.bicEncrypted);
  } catch { /* non bloquant */ }

  let logoSignedUrl: string | null = null;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = url && key ? createClient(url, key) : null;
  const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";

  if (soc?.logoUrl && supabase) {
    try {
      const cleanPath = soc.logoUrl.replace(/\.\.\//g, "").replace(/^\//, "");
      let storagePath = cleanPath;
      if (cleanPath.startsWith("http")) {
        const m = cleanPath.match(/\/storage\/v1\/object\/(?:upload\/sign\/|sign\/|public\/)[^/]+\/(.+?)(?:\?|$)/);
        storagePath = m ? m[1] : "";
      }
      if (storagePath) {
        const { data: blob } = await supabase.storage.from(bucket).download(storagePath);
        if (blob) {
          const ab = await blob.arrayBuffer();
          const b64 = Buffer.from(ab).toString("base64");
          const mime = /\.png$/i.test(storagePath) ? "image/png" : "image/jpeg";
          logoSignedUrl = `data:${mime};base64,${b64}`;
        }
      }
    } catch { /* non bloquant */ }
  }

  const tenantName = tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? "—")
    : (`${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—");
  const tenantAddress = tenant.entityType === "PERSONNE_MORALE"
    ? tenant.companyAddress
    : tenant.personalAddress;

  const pdfData = {
    invoiceNumber: quittance.invoiceNumber!,
    invoiceType: "QUITTANCE",
    issueDate: quittance.issueDate.toISOString(),
    dueDate: quittance.dueDate.toISOString(),
    periodStart: quittance.periodStart?.toISOString() ?? null,
    periodEnd: quittance.periodEnd?.toISOString() ?? null,
    totalHT: quittance.totalHT,
    totalVAT: quittance.totalVAT,
    totalTTC: quittance.totalTTC,
    previousBalance: 0,
    isAvoir: false,
    society: soc ? {
      name: soc.name, addressLine1: soc.addressLine1, postalCode: soc.postalCode,
      city: soc.city, country: soc.country, phone: soc.phone, siret: soc.siret,
      vatNumber: soc.vatNumber, legalForm: soc.legalForm, shareCapital: soc.shareCapital,
      bankName: soc.bankName, vatRegime: soc.vatRegime, legalMentions: soc.legalMentions,
      signatoryName: soc.signatoryName, logoSignedUrl, iban, bic, email: soc.email ?? null,
    } : null,
    tenant: { name: tenantName, address: tenantAddress ?? null, email: to },
    lotLabel: quittance.lease?.lot
      ? `${quittance.lease.lot.building.name} - Lot ${quittance.lease.lot.number}`
      : null,
    lines: quittance.lines.map((l) => ({
      label: l.label, lotNumber: null, totalHT: l.totalHT, vatRate: l.vatRate, totalTTC: l.totalTTC,
    })),
    payments: quittance.payments.map((p) => ({
      paidAt: p.paidAt.toISOString(), method: p.method ?? null, amount: p.amount,
    })),
    creditNoteForNumber: null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(React.createElement(InvoicePdf, { data: pdfData }) as any);

  const period = quittance.periodStart
    ? new Date(quittance.periodStart).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : new Date(quittance.issueDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const lotAddress = quittance.lease?.lot?.building?.addressLine1 ?? "";
  const pdfFileName = buildStorageFileName(
    [quittance.invoiceNumber, lotAddress, tenantName],
    "pdf",
    "quittance"
  );

  const bcc = await getAllEmailCopyBcc(societyId);
  await sendReceiptEmail({
    to,
    tenantName,
    invoiceRef: quittance.invoiceNumber!,
    amount: quittance.totalTTC,
    period,
    paidAt: quittance.payments[0]
      ? new Date(quittance.payments[0].paidAt).toLocaleDateString("fr-FR")
      : new Date().toLocaleDateString("fr-FR"),
    societyName: soc?.name ?? "",
    pdfAttachment: { filename: pdfFileName, content: pdfBuffer },
    bcc,
  });

  if (supabase) {
    const year = new Date(quittance.issueDate).getFullYear();
    const docStoragePath = `quittances/${societyId}/${year}/${pdfFileName}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(docStoragePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) {
      console.error("[generateQuittancePdfAndSend] Upload quittance échoué:", uploadError.message);
      return;
    }

    await prisma.invoice.update({
      where: { id: quittanceId },
      data: { fileUrl: docStoragePath, sentAt: new Date(), sentBy: to, status: "ENVOYEE" },
    });

    await prisma.document.create({
      data: {
        societyId,
        tenantId: quittance.tenantId,
        ...(quittance.leaseId ? { leaseId: quittance.leaseId } : {}),
        fileName: pdfFileName,
        fileUrl: docStoragePath,
        storagePath: docStoragePath,
        fileSize: pdfBuffer.length,
        mimeType: "application/pdf",
        category: "quittance",
        description: `Quittance ${quittance.invoiceNumber} générée automatiquement le ${new Date().toLocaleDateString("fr-FR")}`,
      },
    });
  }

  await createAuditLog({
    societyId,
    userId: "system",
    action: "SEND_EMAIL",
    entity: "Invoice",
    entityId: quittanceId,
    details: { to, invoiceNumber: quittance.invoiceNumber, type: "AUTO_QUITTANCE" },
  });
}

/** Envoie la facture par email au locataire. */
export async function sendInvoiceToTenant(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ sent: true }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: {
        tenant: { select: { email: true, billingEmail: true, firstName: true, lastName: true, entityType: true, companyName: true } },
        society: { select: { name: true } },
        lines: { select: { label: true, totalTTC: true } },
      },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const to = invoice.tenant.billingEmail || invoice.tenant.email;
    if (!to) return { success: false, error: "Le locataire n'a pas d'adresse email" };

    const tenantName =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? (invoice.tenant.companyName ?? "—")
        : `${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim() || "—";

    const period = invoice.periodStart
      ? new Date(invoice.periodStart).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : new Date(invoice.issueDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    const result = await sendInvoiceEmail({
      to,
      tenantName,
      invoiceRef: invoice.invoiceNumber ?? "",
      amount: invoice.totalTTC,
      dueDate: new Date(invoice.dueDate).toLocaleDateString("fr-FR"),
      period,
      societyName: invoice.society?.name ?? "",
      items: invoice.lines.map((l) => ({ label: l.label, amount: l.totalTTC })),
    });

    if (!result.success) return { success: false, error: result.error ?? "Erreur d'envoi" };

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "SEND_EMAIL",
      entity: "Invoice",
      entityId: invoice.id,
      details: { to, invoiceNumber: invoice.invoiceNumber },
    });

    return { success: true, data: { sent: true } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[sendInvoiceToTenant] exception:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Valide un brouillon de facture. Passage BROUILLON → VALIDEE.
 */
export async function validateInvoice(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId, status: "BROUILLON" },
      select: { id: true, invoiceNumber: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable ou déjà validée" };

    const { invoiceNumber } = await prisma.$transaction(async (tx) => {
      const number = await getNextInvoiceNumber(societyId, tx);
      return tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "VALIDEE", validatedAt: new Date(), invoiceNumber: number },
        select: { invoiceNumber: true },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { transition: "BROUILLON → VALIDEE", invoiceNumber },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId, invoiceNumber: invoiceNumber! } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[validateInvoice]", error);
    return { success: false, error: "Erreur lors de la validation" };
  }
}

/**
 * Valide en masse un lot de factures brouillon.
 */
export async function validateBatchInvoices(
  societyId: string,
  invoiceIds: string[]
): Promise<ActionResult<{ validated: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const drafts = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, societyId, status: "BROUILLON" },
      select: { id: true, invoiceNumber: true },
    });

    // Validation séquentielle — chaque facture reçoit un numéro unique dans l'ordre
    const validatedAt = new Date();
    for (const draft of drafts) {
      await prisma.$transaction(async (tx) => {
        const number = await getNextInvoiceNumber(societyId, tx);
        await tx.invoice.update({
          where: { id: draft.id },
          data: { status: "VALIDEE", validatedAt, invoiceNumber: number },
        });
      });
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceIds.join(","),
      details: { transition: "BROUILLON → VALIDEE", count: drafts.length },
    });

    revalidatePath("/facturation");
    return { success: true, data: { validated: drafts.length } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[validateBatchInvoices]", error);
    return { success: false, error: "Erreur lors de la validation en masse" };
  }
}

/**
 * Annule une facture. Génère automatiquement un avoir si la facture a déjà été envoyée.
 */
export async function cancelInvoice(
  societyId: string,
  invoiceId: string,
  reason?: string
): Promise<ActionResult<{ id: string; creditNoteId?: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: { lines: true, creditNotes: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status === "ANNULEE") return { success: false, error: "Facture déjà annulée" };
    if (invoice.status === "PAYE") return { success: false, error: "Impossible d'annuler une facture payée" };
    if (invoice.creditNotes.length > 0) return { success: false, error: "Un avoir existe déjà pour cette facture" };

    let creditNoteId: string | undefined;

    const needsCreditNote = ["ENVOYEE", "EN_ATTENTE", "PARTIELLEMENT_PAYE", "EN_RETARD", "RELANCEE", "LITIGIEUX"].includes(invoice.status);

    if (needsCreditNote) {
      const creditNote = await prisma.$transaction(async (tx) => {
        const invoiceNumber = await getNextInvoiceNumber(societyId, tx);
        return tx.invoice.create({
          data: {
            societyId,
            tenantId: invoice.tenantId,
            leaseId: invoice.leaseId,
            invoiceNumber,
            invoiceType: "AVOIR",
            status: "VALIDEE",
            issueDate: new Date(),
            dueDate: new Date(),
            periodStart: invoice.periodStart,
            periodEnd: invoice.periodEnd,
            totalHT: -invoice.totalHT,
            totalVAT: -invoice.totalVAT,
            totalTTC: -invoice.totalTTC,
            creditNoteForId: invoiceId,
            validatedAt: new Date(),
            lines: {
              create: invoice.lines.map((line) => ({
                label: `Avoir : ${line.label}`,
                quantity: line.quantity,
                unitPrice: -line.unitPrice,
                vatRate: line.vatRate,
                totalHT: -line.totalHT,
                totalVAT: -line.totalVAT,
                totalTTC: -line.totalTTC,
              })),
            },
          },
        });
      });
      creditNoteId = creditNote.id;
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "ANNULEE", cancelledAt: new Date(), cancelReason: reason ?? null },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { transition: `${invoice.status} → ANNULEE`, reason, creditNoteId },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId, creditNoteId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[cancelInvoice]", error);
    return { success: false, error: "Erreur lors de l'annulation" };
  }
}

/**
 * Marque une facture comme litigieuse.
 */
export async function markAsLitigious(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        societyId,
        status: { in: ["EN_RETARD", "RELANCEE"] },
      },
    });
    if (!invoice) return { success: false, error: "Facture introuvable ou statut incompatible" };

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "LITIGIEUX" },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { transition: `${invoice.status} → LITIGIEUX` },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[markAsLitigious]", error);
    return { success: false, error: "Erreur lors du passage en litigieux" };
  }
}

/**
 * Marque une facture comme irrécouvrable (perte).
 */
export async function markAsIrrecoverable(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        societyId,
        status: { in: ["EN_RETARD", "RELANCEE", "LITIGIEUX"] },
      },
    });
    if (!invoice) return { success: false, error: "Facture introuvable ou statut incompatible" };

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "IRRECOUVRABLE" },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { transition: `${invoice.status} → IRRECOUVRABLE` },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[markAsIrrecoverable]", error);
    return { success: false, error: "Erreur lors du passage en irrécouvrable" };
  }
}
