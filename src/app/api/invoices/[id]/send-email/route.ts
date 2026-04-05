import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { decrypt } from "@/lib/encryption";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf } from "@/lib/invoice-pdf";
import { createClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { sendInvoiceEmail, sendReceiptEmail } from "@/lib/email";
import React from "react";

export const maxDuration = 60;

const STORAGE_BUCKET = "documents";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const TYPE_LABELS: Record<string, string> = {
  APPEL_LOYER: "votre appel de loyers",
  QUITTANCE: "votre quittance de loyer",
  REGULARISATION_CHARGES: "votre regularisation de charges",
  REFACTURATION: "votre refacturation",
  AVOIR: "votre avoir",
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifie" } }, { status: 401 });

    const { id } = await params;

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId)
      return NextResponse.json({ error: { code: "NO_SOCIETY", message: "Societe non selectionnee" } }, { status: 400 });

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id, societyId },
      include: {
        society: true,
        tenant: true,
        lines: true,
        payments: { orderBy: { paidAt: "asc" } },
        creditNoteFor: { select: { invoiceNumber: true } },
        lease: { select: { lot: { select: { number: true, building: { select: { name: true, addressLine1: true } } } } } },
      },
    });
    if (!invoice)
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Facture introuvable" } }, { status: 404 });

    if (invoice.status === "BROUILLON")
      return NextResponse.json({ error: { code: "INVALID_STATUS", message: "Impossible d'envoyer une facture en brouillon. Veuillez d'abord la valider." } }, { status: 400 });

    const to = invoice.tenant.billingEmail || invoice.tenant.email;
    if (!to)
      return NextResponse.json({ error: { code: "NO_EMAIL", message: "Le locataire n'a pas d'adresse email" } }, { status: 400 });

    const soc = invoice.society;

    // Dechiffrement IBAN/BIC
    let iban: string | null = null;
    let bic: string | null = null;
    try {
      if (soc?.ibanEncrypted) iban = decrypt(soc.ibanEncrypted);
      if (soc?.bicEncrypted) bic = decrypt(soc.bicEncrypted);
    } catch { /* non bloquant */ }

    // Logo societe (base64)
    let logoSignedUrl: string | null = null;
    const supabase = getSupabaseClient();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? STORAGE_BUCKET;
    if (soc?.logoUrl) {
      try {
        const cleanPath = soc.logoUrl.replace(/\.\.\//g, "").replace(/^\//, "");
        let storagePath = cleanPath;
        if (cleanPath.startsWith("http")) {
          const m = cleanPath.match(/\/storage\/v1\/object\/(?:upload\/sign\/|sign\/|public\/)[^/]+\/(.+?)(?:\?|$)/);
          storagePath = m ? m[1] : "";
        }
        if (storagePath && supabase) {
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

    const tenantName =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? (invoice.tenant.companyName ?? "---")
        : (`${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim() || "---");

    const tenantAddress =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? invoice.tenant.companyAddress
        : invoice.tenant.personalAddress;

    const pdfData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      periodStart: invoice.periodStart?.toISOString() ?? null,
      periodEnd: invoice.periodEnd?.toISOString() ?? null,
      totalHT: invoice.totalHT,
      totalVAT: invoice.totalVAT,
      totalTTC: invoice.totalTTC,
      previousBalance: 0,
      isAvoir: invoice.invoiceType === "AVOIR",
      society: soc ? {
        name: soc.name,
        addressLine1: soc.addressLine1,
        postalCode: soc.postalCode,
        city: soc.city,
        country: soc.country,
        phone: soc.phone,
        siret: soc.siret,
        vatNumber: soc.vatNumber,
        legalForm: soc.legalForm,
        shareCapital: soc.shareCapital,
        bankName: soc.bankName,
        vatRegime: soc.vatRegime,
        legalMentions: soc.legalMentions,
        signatoryName: soc.signatoryName,
        logoSignedUrl,
        iban,
        bic,
        email: soc.email ?? null,
      } : null,
      tenant: {
        name: tenantName,
        address: tenantAddress ?? null,
        email: to,
      },
      lotLabel: null,
      lines: invoice.lines.map((l) => ({
        label: l.label,
        lotNumber: null,
        totalHT: l.totalHT,
        vatRate: l.vatRate,
        totalTTC: l.totalTTC,
      })),
      payments: invoice.payments.map((p) => ({
        paidAt: p.paidAt.toISOString(),
        method: p.method ?? null,
        amount: p.amount,
      })),
      creditNoteForNumber: invoice.creditNoteFor?.invoiceNumber ?? null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(React.createElement(InvoicePdf, { data: pdfData }) as any);

    const period = invoice.periodStart
      ? new Date(invoice.periodStart).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : new Date(invoice.issueDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    const typeLabel = TYPE_LABELS[invoice.invoiceType as string] ?? "votre facture";

    // Nom de fichier enrichi : numéro_adresse_locataire
    const lotAddress = invoice.lease?.lot?.building?.addressLine1 ?? "";
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ _-]/g, "").replace(/\s+/g, "_").slice(0, 60);
    const pdfFileName = [
      invoice.invoiceNumber,
      sanitize(lotAddress),
      sanitize(tenantName),
    ].filter(Boolean).join("_") + ".pdf";

    const isQuittance = invoice.invoiceType === "QUITTANCE";

    const emailResult = isQuittance
      ? await sendReceiptEmail({
          to,
          tenantName,
          invoiceRef: invoice.invoiceNumber,
          amount: invoice.totalTTC,
          period,
          paidAt: invoice.payments[0]
            ? new Date(invoice.payments[0].paidAt).toLocaleDateString("fr-FR")
            : new Date().toLocaleDateString("fr-FR"),
          societyName: soc?.name ?? "",
          pdfAttachment: { filename: pdfFileName, content: pdfBuffer },
        })
      : await sendInvoiceEmail({
          to,
          tenantName,
          invoiceRef: invoice.invoiceNumber,
          amount: invoice.totalTTC,
          dueDate: new Date(invoice.dueDate).toLocaleDateString("fr-FR"),
          period,
          societyName: soc?.name ?? "",
          typeLabel,
          items: invoice.lines.map((l) => ({ label: l.label, amount: l.totalTTC })),
          pdfAttachment: { filename: pdfFileName, content: pdfBuffer },
        });

    if (!emailResult.success)
      return NextResponse.json({ error: { code: "EMAIL_ERROR", message: emailResult.error ?? "Erreur d'envoi" } }, { status: 500 });

    // Dépôt automatique du PDF dans le module documents
    if (supabase) {
      try {
        const bucketName = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
        const year = new Date(invoice.issueDate).getFullYear();
        const folder = isQuittance ? "quittances" : "invoices";
        const docStoragePath = `${folder}/${societyId}/${year}/${pdfFileName}`;

        await supabase.storage
          .from(bucketName)
          .upload(docStoragePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

        await prisma.invoice.update({
          where: { id },
          data: { fileUrl: docStoragePath, sentAt: new Date(), sentBy: to, resendEmailId: emailResult.emailId ?? null },
        });

        await prisma.document.create({
          data: {
            societyId,
            tenantId: invoice.tenantId,
            ...(invoice.leaseId ? { leaseId: invoice.leaseId } : {}),
            fileName: pdfFileName,
            fileUrl: docStoragePath,
            storagePath: docStoragePath,
            fileSize: pdfBuffer.length,
            mimeType: "application/pdf",
            category: isQuittance ? "quittance" : "facture",
            description: isQuittance
              ? `Quittance ${invoice.invoiceNumber} envoyée par email le ${new Date().toLocaleDateString("fr-FR")}`
              : `Facture ${invoice.invoiceNumber} envoyée par email le ${new Date().toLocaleDateString("fr-FR")}`,
          },
        });
      } catch (docError) {
        console.error("[send-email] Dépôt document échoué (non bloquant):", docError);
      }
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "SEND_EMAIL",
      entity: "Invoice",
      entityId: id,
      details: { to, invoiceNumber: invoice.invoiceNumber },
    });

    return NextResponse.json({ success: true, emailId: emailResult.emailId });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: { code: "FORBIDDEN", message: error.message } }, { status: 403 });
    console.error("[send-email]", error);
    return NextResponse.json({ error: { code: "SEND_ERROR", message: "Erreur lors de l'envoi" } }, { status: 500 });
  }
}
