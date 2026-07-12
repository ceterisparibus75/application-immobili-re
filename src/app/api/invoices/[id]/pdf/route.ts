import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { resolveInvoiceBankDetails } from "@/lib/invoice-bank-details";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf } from "@/lib/invoice-pdf";
import { createClient } from "@supabase/supabase-js";
import { computeInvoicePreviousBalance } from "@/actions/tenant-queries";
import { createAuditLog } from "@/lib/audit";
import * as nodePath from "path";
import { env } from "@/lib/env";
import { buildStorageFileName } from "@/lib/storage-path";
import React from "react";

const STORAGE_BUCKET = "documents";

function getSupabaseClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isPreview = _req.nextUrl.searchParams.get("preview") === "1";
    const routeContext = await requireActiveSocietyRouteContext({ minRole: "COMPTABLE" });
    if (routeContext instanceof NextResponse) {
      if (routeContext.status === 400)
        return NextResponse.json({ error: { code: "NO_SOCIETY", message: "Société non sélectionnée" } }, { status: 400 });
      if (routeContext.status === 403)
        return NextResponse.json({ error: { code: "FORBIDDEN", message: "Accès refusé" } }, { status: 403 });
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifié" } }, { status: 401 });
    }
    const context = routeContext;

    const { id } = await params;

    // 4. Récupération de la facture
    const invoice = await prisma.invoice.findFirst({
      where: { id, societyId: context.societyId },
      include: {
        society: true,
        tenant: true,
        lines: true,
        payments: { orderBy: { paidAt: "asc" } },
        creditNoteFor: { select: { invoiceNumber: true } },
        lease: { include: { lot: { include: { building: true } } } },
      },
    });
    if (!invoice)
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Facture introuvable" } }, { status: 404 });
    if (!invoice.invoiceNumber && !isPreview)
      return NextResponse.json({ error: { code: "DRAFT", message: "Impossible de générer un PDF pour un brouillon non validé" } }, { status: 400 });

    const soc = invoice.society;

    // 5. Coordonnées bancaires — substitution éventuelle par celles de
    // l'usufruitier en cas de démembrement actif sur le lot du bail.
    const bankDetails = await resolveInvoiceBankDetails(
      context.societyId,
      {
        ibanEncrypted: soc?.ibanEncrypted ?? null,
        bicEncrypted: soc?.bicEncrypted ?? null,
        bankName: soc?.bankName ?? null,
      },
      invoice.lease?.lot?.id ?? null,
      invoice.issueDate,
    );
    const iban = bankDetails.iban;
    const bic = bankDetails.bic;

    // 6. Logo société (base64 pour intégration dans le PDF)
    let logoSignedUrl: string | null = null;
    const supabase = getSupabaseClient();
    const bucket = env.SUPABASE_STORAGE_BUCKET ?? STORAGE_BUCKET;
    if (soc?.logoUrl) {
      // Sanitize path: decode URL-encoded chars, normalize with posix to collapse all traversals
      let decoded = soc.logoUrl;
      try { decoded = decodeURIComponent(decoded); decoded = decodeURIComponent(decoded); } catch { /* ignore */ }
      const normalized = nodePath.posix.normalize(decoded.replace(/\0/g, "")).replace(/^\/+/, "");
      if (normalized.startsWith("..")) { throw new Error("Path traversal detected"); }
      const cleanPath = normalized;
      try {
        // Résoudre le chemin de stockage : chemin relatif ou URL Supabase complète
        let storagePath = cleanPath;
        if (cleanPath.startsWith("http")) {
          // Extraire le chemin depuis une URL Supabase (upload/sign, sign, ou public)
          const m = cleanPath.match(/\/storage\/v1\/object\/(?:upload\/sign\/|sign\/|public\/)[^/]+\/(.+?)(?:\?|$)/);
          storagePath = m ? m[1] : "";
        }
        if (storagePath && supabase) {
          const { data: blob, error: dlError } = await supabase.storage.from(bucket).download(storagePath);
          if (dlError) {
            console.error("[pdf] Erreur téléchargement logo:", dlError.message, "| path:", storagePath, "| bucket:", bucket);
          } else if (blob) {
            const ab = await blob.arrayBuffer();
            const b64 = Buffer.from(ab).toString("base64");
            const mime = /\.png$/i.test(storagePath) ? "image/png" : "image/jpeg";
            logoSignedUrl = `data:${mime};base64,${b64}`;
          }
        }
      } catch (logoErr) {
        console.error("[pdf] Exception logo:", logoErr);
      }
    }

    // 7. Solde précédent = solde du compte locataire AVANT cette facture.
    // Utilise la même logique que /locataires/[id] pour rester cohérent
    // (inclut avoirs, ajustements non réconciliés, surplus bancaires non
    // affectés — donc un locataire ayant trop versé apparaîtra en négatif).
    const previousBalance = await computeInvoicePreviousBalance(
      context.societyId,
      invoice.tenantId,
      { excludeInvoiceId: invoice.id },
    );

    // 8. Construction des données pour le PDF
    const lot = invoice.lease?.lot;
    const lotLabel = lot
      ? `${lot.number} - ${lot.building.addressLine1 ?? ""}, ${lot.building.postalCode ?? ""} ${lot.building.city ?? ""}`
      : null;

    const tenantName =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? (invoice.tenant.companyName ?? "---")
        : (`${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim() || "---");

    const tenantAddress =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? invoice.tenant.companyAddress
        : invoice.tenant.personalAddress;

    const pdfData = {
      invoiceNumber: invoice.invoiceNumber ?? "Prévisualisation",
      invoiceType: invoice.invoiceType,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      periodStart: invoice.periodStart?.toISOString() ?? null,
      periodEnd: invoice.periodEnd?.toISOString() ?? null,
      totalHT: invoice.totalHT,
      totalVAT: invoice.totalVAT,
      totalTTC: invoice.totalTTC,
      previousBalance,
      isAvoir: invoice.invoiceType === "AVOIR",
      society: soc
        ? {
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
          }
        : null,
      tenant: {
        name: tenantName,
        address: tenantAddress ?? null,
        email: invoice.tenant.email ?? null,
      },
      lotLabel,
      lines: invoice.lines.map((l) => ({
        label: l.label,
        lotNumber: lot?.number ?? null,
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
      note: invoice.note ?? null,
    };

    // 8b. Correction de la date d'émission si elle est dans le futur (bug historique)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isPreview && invoice.issueDate > today && ["EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE"].includes(invoice.status)) {
      const newIssueDate = new Date();
      newIssueDate.setHours(0, 0, 0, 0);
      await prisma.invoice.update({ where: { id }, data: { issueDate: newIssueDate } });
      pdfData.issueDate = newIssueDate.toISOString();
      await createAuditLog({
        societyId: context.societyId,
        userId: context.userId,
        action: "UPDATE",
        entity: "Invoice",
        entityId: id,
        details: { field: "issueDate", from: invoice.issueDate.toISOString(), to: newIssueDate.toISOString(), reason: "date future corrigée automatiquement" },
      });
    }

    // 9. Génération du PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(React.createElement(InvoicePdf, { data: pdfData }) as any);

    // 10. Upload dans Supabase Storage (si configuré)
    const buildingName = lot?.building?.name ?? lot?.building?.addressLine1 ?? "";
    const periodDate = invoice.periodStart ? new Date(invoice.periodStart) : new Date(invoice.dueDate);
    const period = `${String(periodDate.getMonth() + 1).padStart(2, "0")}-${periodDate.getFullYear()}`;
    const pdfFileName = buildStorageFileName(
      [invoice.invoiceNumber ?? "previsualisation", buildingName, tenantName, period],
      "pdf",
      "facture"
    );
    const year = new Date(invoice.issueDate).getFullYear();
    const pdfPath = `invoices/${context.societyId}/${year}/${pdfFileName}`;
    if (!isPreview && supabase) {
      try {
        const { error: uploadError } = await supabase.storage.from(bucket).upload(pdfPath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (uploadError) {
          console.error("[pdf] Échec upload Supabase:", uploadError.message, "| path:", pdfPath, "| bucket:", bucket);
        } else {
          await prisma.invoice.update({ where: { id }, data: { fileUrl: pdfPath } });
        }
      } catch (uploadError) {
        console.error("[pdf] Échec upload Supabase:", uploadError);
        // On continue quand même — le PDF sera renvoyé au client
      }
    }

    // 11. Audit log
    if (!isPreview) {
      await createAuditLog({
        societyId: context.societyId,
        userId: context.userId,
        action: "GENERATE_PDF",
        entity: "Invoice",
        entityId: id,
        details: { invoiceNumber: invoice.invoiceNumber },
      });
    }

    // 12. Réponse
    const filename = pdfFileName;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": isPreview ? "private, no-store" : "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[pdf]", error);
    return NextResponse.json(
      { error: { code: "PDF_ERROR", message: "Erreur lors de la génération du PDF" } },
      { status: 500 }
    );
  }
}
