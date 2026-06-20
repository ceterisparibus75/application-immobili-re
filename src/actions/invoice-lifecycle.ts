"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  recordPaymentSchema,
  updateInvoiceNoteSchema,
  updateDraftInvoiceSchema,
  type RecordPaymentInput,
  type UpdateDraftInvoiceInput,
} from "@/validations/invoice";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { InvoiceStatus } from "@/generated/prisma/client";
import { decrypt } from "@/lib/encryption";
import { sendInvoiceEmail } from "@/lib/email";
import { buildStorageFileName } from "@/lib/storage-path";
import { logNonBlocking } from "@/lib/non-blocking-log";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  createCustomerInvoiceJournalEntry,
  createCustomerPaymentJournalEntry,
} from "@/lib/accounting-automation";
import { env } from "@/lib/env";
import { getNextInvoiceNumber, getNextCreditNoteNumber, getNextReceiptNumber } from "./invoice-shared";

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
    await createCustomerPaymentJournalEntry(prisma, societyId, payment.id);

    const totalPaid =
      invoice.payments.reduce((s, p) => s + p.amount, 0) + parsed.data.amount;
    // En gestion tiers, le locataire ne nous verse que le net (loyer - honoraires).
    // On compare donc totalPaid à expectedNetAmount plutôt qu'à totalTTC, sinon
    // une facture entièrement payée resterait à PARTIELLEMENT_PAYE.
    const targetAmount = invoice.isThirdPartyManaged && invoice.expectedNetAmount
      ? invoice.expectedNetAmount
      : invoice.totalTTC;
    let newStatus: InvoiceStatus = invoice.status;
    // Tolérance 0.01 € pour absorber les arrondis flottants (ex. 1499,99 vs 1500).
    if (totalPaid >= targetAmount - 0.01) {
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
      const invoiceNumber = await getNextReceiptNumber(societyId, tx);
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
        isReconciled: true,
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
  } catch (e) { logNonBlocking("invoice-lifecycle.decryptBank", e); }

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
    } catch (e) { logNonBlocking("invoice-lifecycle.fetchLogo", e); }
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

  // Même nomenclature que les factures (route /api/invoices/[id]/pdf) :
  // {numéro}_{nom-immeuble-ou-adresse}_{locataire}_{MM-YYYY}.pdf
  const buildingName =
    quittance.lease?.lot?.building?.name ??
    quittance.lease?.lot?.building?.addressLine1 ??
    "";
  const periodDate = quittance.periodStart
    ? new Date(quittance.periodStart)
    : new Date(quittance.issueDate);
  const periodFile = `${String(periodDate.getMonth() + 1).padStart(2, "0")}-${periodDate.getFullYear()}`;
  const pdfFileName = buildStorageFileName(
    [quittance.invoiceNumber, buildingName, tenantName, periodFile],
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
      data: { fileUrl: docStoragePath, sentAt: new Date(), sentBy: to, status: "PAYE" },
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
      select: { id: true, invoiceNumber: true, invoiceType: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable ou déjà validée" };

    const { invoiceNumber } = await prisma.$transaction(async (tx) => {
      const number = invoice.invoiceType === "AVOIR" ? await getNextCreditNoteNumber(societyId, tx) : await getNextInvoiceNumber(societyId, tx);
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "VALIDEE", validatedAt: new Date(), invoiceNumber: number },
        select: { invoiceNumber: true },
      });
      await createCustomerInvoiceJournalEntry(tx, societyId, invoiceId);
      return updated;
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
 * Duplique une facture en nouveau brouillon, sans reprendre les paiements ni les numéros.
 */
export async function duplicateInvoiceAsDraft(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      include: { lines: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const draft = await prisma.invoice.create({
      data: {
        societyId,
        tenantId: invoice.tenantId,
        leaseId: invoice.leaseId,
        buildingId: invoice.buildingId,
        invoiceType: invoice.invoiceType,
        status: "BROUILLON",
        issueDate: new Date(),
        dueDate: invoice.dueDate,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        totalHT: invoice.totalHT,
        totalVAT: invoice.totalVAT,
        totalTTC: invoice.totalTTC,
        note: invoice.note,
        creditNoteForId: invoice.invoiceType === "AVOIR" ? invoice.creditNoteForId : null,
        isThirdPartyManaged: invoice.isThirdPartyManaged,
        managementFeeHT: invoice.managementFeeHT,
        managementFeeVAT: invoice.managementFeeVAT,
        managementFeeTTC: invoice.managementFeeTTC,
        expectedNetAmount: invoice.expectedNetAmount,
        lines: {
          create: invoice.lines.map((line) => ({
            label: line.label,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            totalHT: line.totalHT,
            totalVAT: line.totalVAT,
            totalTTC: line.totalTTC,
            accountingAccountCode: line.accountingAccountCode,
          })),
        },
      },
      select: { id: true, tenantId: true },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Invoice",
      entityId: draft.id,
      details: { action: "duplicate_as_draft", sourceInvoiceId: invoiceId },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${draft.id}`);
    revalidatePath(`/locataires/${draft.tenantId}`);
    return { success: true, data: { id: draft.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[duplicateInvoiceAsDraft]", error);
    return { success: false, error: "Erreur lors de la duplication" };
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
      select: { id: true, invoiceNumber: true, invoiceType: true },
    });

    // Validation séquentielle — chaque facture reçoit un numéro unique dans l'ordre
    const validatedAt = new Date();
    for (const draft of drafts) {
      await prisma.$transaction(async (tx) => {
        const number = draft.invoiceType === "AVOIR" ? await getNextCreditNoteNumber(societyId, tx) : await getNextInvoiceNumber(societyId, tx);
        await tx.invoice.update({
          where: { id: draft.id },
          data: { status: "VALIDEE", validatedAt, invoiceNumber: number },
        });
        await createCustomerInvoiceJournalEntry(tx, societyId, draft.id);
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
        const invoiceNumber = await getNextCreditNoteNumber(societyId, tx);
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
 * Solde un avoir (AVOIR) en statut VALIDEE ou EN_ATTENTE → PAYE.
 * Utilisé pour confirmer qu'un avoir a été remboursé ou imputé.
 */
export async function settleAvoir(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId, invoiceType: "AVOIR" },
      select: { id: true, status: true, totalTTC: true, creditNoteForId: true },
    });
    if (!invoice) return { success: false, error: "Avoir introuvable" };
    if (!["VALIDEE", "EN_ATTENTE", "ENVOYEE"].includes(invoice.status)) {
      return { success: false, error: "Cet avoir ne peut pas être soldé dans son état actuel" };
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAYE" },
    });

    // Mettre à jour la facture d'origine si l'avoir la couvre
    if (invoice.creditNoteForId) {
      const original = await prisma.invoice.findFirst({
        where: { id: invoice.creditNoteForId, societyId },
        select: { id: true, status: true, totalTTC: true, payments: { select: { amount: true } } },
      });
      if (original && !["ANNULEE", "PAYE", "BROUILLON"].includes(original.status)) {
        const paid = original.payments.reduce((s, p) => s + p.amount, 0);
        const remaining = original.totalTTC - paid;
        // avoir.totalTTC est négatif, il réduit le solde restant
        const afterAvoir = remaining + invoice.totalTTC;
        let newStatus: InvoiceStatus | null = null;
        if (afterAvoir <= 0.01) {
          newStatus = "PAYE";
        } else if (afterAvoir < remaining) {
          newStatus = "PARTIELLEMENT_PAYE";
        }
        if (newStatus) {
          await prisma.invoice.update({
            where: { id: original.id },
            data: { status: newStatus },
          });
          revalidatePath(`/facturation/${original.id}`);
        }
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { transition: `${invoice.status} → PAYE`, settled: true },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[settleAvoir]", error);
    return { success: false, error: "Erreur lors du solde de l'avoir" };
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

/**
 * Rattache une facture à un immeuble (pour les factures sans bail).
 * Passe null pour supprimer le rattachement.
 */
export async function linkInvoiceToBuilding(
  societyId: string,
  invoiceId: string,
  buildingId: string | null,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: { id: true, buildingId: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    if (buildingId) {
      const building = await prisma.building.findFirst({
        where: { id: buildingId, societyId },
        select: { id: true },
      });
      if (!building) return { success: false, error: "Immeuble introuvable" };
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { buildingId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { buildingId, previousBuildingId: invoice.buildingId },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[linkInvoiceToBuilding]", error);
    return { success: false, error: "Erreur lors du rattachement à l'immeuble" };
  }
}
export async function updateInvoiceNote(
  societyId: string,
  invoiceId: string,
  note: string | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = updateInvoiceNoteSchema.safeParse({ invoiceId, note });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    await prisma.invoice.update({
      where: { id: invoiceId, societyId },
      data: { note: parsed.data.note ?? null },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { field: "note" },
    });

    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateInvoiceNote]", error);
    return { success: false, error: "Erreur lors de la mise à jour de la note" };
  }
}


/**
 * Supprime définitivement un brouillon de facture (hard delete).
 * Seul le statut BROUILLON est autorisé — une facture validée ne peut pas être supprimée.
 */
export async function deleteDraftInvoice(
  societyId: string,
  invoiceId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: { id: true, status: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status !== "BROUILLON") {
      return { success: false, error: "Seuls les brouillons peuvent être supprimés" };
    }

    await prisma.invoice.delete({ where: { id: invoiceId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { reason: "Suppression brouillon" },
    });

    revalidatePath("/facturation");
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteDraftInvoice]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/**
 * Met à jour les dates et les lignes d'un brouillon de facture.
 * Seul le statut BROUILLON est autorisé.
 */
export async function updateDraftInvoice(
  societyId: string,
  invoiceId: string,
  input: UpdateDraftInvoiceInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: { id: true, status: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status !== "BROUILLON") {
      return { success: false, error: "Seuls les brouillons peuvent être modifiés" };
    }

    const parsed = updateDraftInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const totals = parsed.data.lines.reduce(
      (acc, line) => {
        const ht = line.quantity * line.unitPrice;
        const vat = ht * (line.vatRate / 100);
        return { ht: acc.ht + ht, vat: acc.vat + vat, ttc: acc.ttc + ht + vat };
      },
      { ht: 0, vat: 0, ttc: 0 }
    );

    const round2 = (n: number) => Math.round(n * 100) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId } });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          issueDate: new Date(parsed.data.issueDate),
          dueDate: new Date(parsed.data.dueDate),
          periodStart: parsed.data.periodStart ? new Date(parsed.data.periodStart) : null,
          periodEnd: parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : null,
          totalHT: round2(totals.ht),
          totalVAT: round2(totals.vat),
          totalTTC: round2(totals.ttc),
          lines: {
            create: parsed.data.lines.map((line) => ({
              label: line.label,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              vatRate: line.vatRate,
              totalHT: round2(line.quantity * line.unitPrice),
              totalVAT: round2(line.quantity * line.unitPrice * (line.vatRate / 100)),
              totalTTC: round2(line.quantity * line.unitPrice * (1 + line.vatRate / 100)),
            })),
          },
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { reason: "Modification brouillon" },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateDraftInvoice]", error);
    return { success: false, error: "Erreur lors de la modification" };
  }
}

/**
 * Met à jour uniquement les dates d'un brouillon.
 */
export async function updateDraftDates(
  societyId: string,
  invoiceId: string,
  input: { issueDate: string; dueDate: string; periodStart?: string | null; periodEnd?: string | null }
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: { id: true, status: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status !== "BROUILLON") return { success: false, error: "Seuls les brouillons peuvent être modifiés" };
    if (!input.issueDate || !input.dueDate) return { success: false, error: "Les dates d'émission et d'échéance sont requises" };

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        issueDate: new Date(input.issueDate),
        dueDate: new Date(input.dueDate),
        periodStart: input.periodStart ? new Date(input.periodStart) : null,
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
      },
    });

    await createAuditLog({ societyId, userId: context.userId, action: "UPDATE", entity: "Invoice", entityId: invoiceId, details: { reason: "Modification dates brouillon" } });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateDraftDates]", error);
    return { success: false, error: "Erreur lors de la modification des dates" };
  }
}

/**
 * Met à jour uniquement les lignes d'un brouillon (recalcule les totaux).
 */
export async function updateDraftLines(
  societyId: string,
  invoiceId: string,
  lines: Array<{ label: string; quantity: number; unitPrice: number; vatRate: number }>
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: { id: true, status: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status !== "BROUILLON") return { success: false, error: "Seuls les brouillons peuvent être modifiés" };
    if (!lines.length) return { success: false, error: "Au moins une ligne est requise" };

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totals = lines.reduce(
      (acc, l) => {
        const ht = l.quantity * l.unitPrice;
        const vat = ht * (l.vatRate / 100);
        return { ht: acc.ht + ht, vat: acc.vat + vat, ttc: acc.ttc + ht + vat };
      },
      { ht: 0, vat: 0, ttc: 0 }
    );

    await prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId } });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          totalHT: round2(totals.ht),
          totalVAT: round2(totals.vat),
          totalTTC: round2(totals.ttc),
          lines: {
            create: lines.map((l) => ({
              label: l.label,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              vatRate: l.vatRate,
              totalHT: round2(l.quantity * l.unitPrice),
              totalVAT: round2(l.quantity * l.unitPrice * (l.vatRate / 100)),
              totalTTC: round2(l.quantity * l.unitPrice * (1 + l.vatRate / 100)),
            })),
          },
        },
      });
    });

    await createAuditLog({ societyId, userId: context.userId, action: "UPDATE", entity: "Invoice", entityId: invoiceId, details: { reason: "Modification lignes brouillon" } });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateDraftLines]", error);
    return { success: false, error: "Erreur lors de la modification des lignes" };
  }
}
