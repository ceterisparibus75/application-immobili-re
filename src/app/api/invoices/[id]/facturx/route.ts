/**
 * GET /api/invoices/[id]/facturx
 *
 * Génère et retourne un PDF/A-3b Factur-X (XML CII BASIC embarqué).
 * Conforme à la réforme française de facturation électronique B2B (EN 16931).
 *
 * Le PDF standard est d'abord généré via @react-pdf/renderer, puis le XML
 * CII est embarqué dedans via node-zugferd pour produire un fichier hybride
 * lisible par l'humain et traitable automatiquement par les logiciels comptables.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { resolveInvoiceBankDetails } from "@/lib/invoice-bank-details";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf } from "@/lib/invoice-pdf";
import { generateFacturX } from "@/lib/einvoice-generator";
import { createClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import * as nodePath from "path";
import { env } from "@/lib/env";
import React from "react";

const STORAGE_BUCKET = "documents";

function getSupabaseClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const routeContext = await requireActiveSocietyRouteContext({ minRole: "COMPTABLE" });
    if (routeContext instanceof NextResponse) {
      if (routeContext.status === 400)
        return NextResponse.json(
          { error: { code: "NO_SOCIETY", message: "Société non sélectionnée" } },
          { status: 400 }
        );
      if (routeContext.status === 403)
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Accès refusé" } },
          { status: 403 }
        );
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Non authentifié" } },
        { status: 401 }
      );
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
    if (!invoice.invoiceNumber)
      return NextResponse.json({ error: { code: "DRAFT", message: "Impossible de générer un Factur-X pour un brouillon non validé" } }, { status: 400 });

    const soc = invoice.society;

    // 5. Coordonnées bancaires (substitution usufruitier si démembrement)
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

    // 6. Logo société (base64)
    let logoSignedUrl: string | null = null;
    const supabase = getSupabaseClient();
    const bucket = env.SUPABASE_STORAGE_BUCKET ?? STORAGE_BUCKET;
    if (soc?.logoUrl) {
      let decoded = soc.logoUrl;
      try {
        decoded = decodeURIComponent(decoded);
        decoded = decodeURIComponent(decoded);
      } catch { /* ignore */ }
      const normalized = nodePath.posix
        .normalize(decoded.replace(/\0/g, ""))
        .replace(/^\/+/, "");
      if (normalized.startsWith("..")) {
        throw new Error("Path traversal detected");
      }
      const cleanPath = normalized;
      try {
        let storagePath = cleanPath;
        if (cleanPath.startsWith("http")) {
          const m = cleanPath.match(
            /\/storage\/v1\/object\/(?:upload\/sign\/|sign\/|public\/)[^/]+\/(.+?)(?:\?|$)/
          );
          storagePath = m ? m[1] : "";
        }
        if (storagePath && supabase) {
          const { data: blob, error: dlError } = await supabase.storage
            .from(bucket)
            .download(storagePath);
          if (!dlError && blob) {
            const ab = await blob.arrayBuffer();
            const b64 = Buffer.from(ab).toString("base64");
            const mime = /\.png$/i.test(storagePath) ? "image/png" : "image/jpeg";
            logoSignedUrl = `data:${mime};base64,${b64}`;
          }
        }
      } catch (logoErr) {
        console.error("[facturx] Exception logo:", logoErr);
      }
    }

    // 7. Solde précédent (factures impayées + reprises de solde hors facture)
    let previousBalance = 0;
    if (invoice.lease?.id) {
      const [unpaid, adjustments] = await Promise.all([
        prisma.invoice.findMany({
          where: {
            societyId: context.societyId,
            leaseId: invoice.lease.id,
            id: { not: invoice.id },
            status: { in: ["EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE"] },
          },
          select: { totalTTC: true, payments: { select: { amount: true } } },
        }),
        prisma.tenantBalanceAdjustment.findMany({
          where: {
            societyId: context.societyId,
            tenantId: invoice.tenantId,
            dueDate: { lte: invoice.issueDate },
            OR: [{ leaseId: invoice.lease.id }, { leaseId: null }],
          },
          select: { amount: true },
        }),
      ]);
      previousBalance = unpaid.reduce((sum, inv) => {
        const paid = inv.payments.reduce((a, pp) => a + pp.amount, 0);
        return sum + (inv.totalTTC - paid);
      }, adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0));
    }

    // 8. Construction des données PDF
    const lot = invoice.lease?.lot;
    const lotLabel = lot
      ? `${lot.number} - ${lot.building.addressLine1 ?? ""}, ${lot.building.postalCode ?? ""} ${lot.building.city ?? ""}`
      : null;

    const tenantName =
      invoice.tenant.entityType === "PERSONNE_MORALE"
        ? (invoice.tenant.companyName ?? "---")
        : `${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim() || "---";

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
    };

    // 9. Génération du PDF standard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(React.createElement(InvoicePdf, { data: pdfData }) as any);

    // 10. Embedding XML Factur-X dans le PDF → PDF/A-3b
    const facturXBuffer = await generateFacturX(pdfBuffer, pdfData);

    // 11. Stockage dans Supabase (optionnel)
    const sanitize = (s: string) =>
      s
        .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ _-]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 60);
    const lotAddr = lot?.building?.addressLine1 ?? "";
    const fileNameBase = [invoice.invoiceNumber, sanitize(lotAddr), sanitize(tenantName)]
      .filter(Boolean)
      .join("_");
    const year = new Date(invoice.issueDate).getFullYear();
    const facturxPath = `invoices/${context.societyId}/${year}/${fileNameBase}_facturx.pdf`;

    if (supabase) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).upload(facturxPath, facturXBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
        await prisma.invoice.update({
          where: { id },
          data: {
            einvoiceXmlUrl: facturxPath,
            einvoiceGeneratedAt: new Date(),
          },
        });
      } catch (uploadError) {
        console.error("[facturx] Échec upload Supabase:", uploadError);
      }
    }

    // 12. Audit log
    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "GENERATE_PDF",
      entity: "Invoice",
      entityId: id,
      details: { invoiceNumber: invoice.invoiceNumber, format: "facturx-basic" },
    });

    // 13. Réponse
    const downloadFilename = `${fileNameBase}_facturx.pdf`;
    return new NextResponse(new Uint8Array(facturXBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        "Content-Length": String(facturXBuffer.length),
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (error) {
    console.error("[facturx]", error);
    return NextResponse.json(
      {
        error: {
          code: "FACTURX_ERROR",
          message: "Erreur lors de la génération Factur-X",
        },
      },
      { status: 500 }
    );
  }
}
