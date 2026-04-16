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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Authentification
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifié" } }, { status: 401 });

    const { id } = await params;

    // 2. Société active (via cookies() au lieu du parsing manuel)
    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId)
      return NextResponse.json({ error: { code: "NO_SOCIETY", message: "Société non sélectionnée" } }, { status: 400 });

    // 3. Permissions
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // 4. Récupération de la facture
    const invoice = await prisma.invoice.findFirst({
      where: { id, societyId },
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

    const soc = invoice.society;

    // 5. Déchiffrement IBAN/BIC
    let iban: string | null = null;
    let bic: string | null = null;
    try {
      if (soc?.ibanEncrypted) iban = decrypt(soc.ibanEncrypted);
      if (soc?.bicEncrypted) bic = decrypt(soc.bicEncrypted);
    } catch {
      console.warn("[pdf] Échec du déchiffrement IBAN/BIC");
    }

    // 6. Logo société (base64 pour intégration dans le PDF)
    let logoSignedUrl: string | null = null;
    const supabase = getSupabaseClient();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? STORAGE_BUCKET;
    console.log("[pdf] logoUrl brut:", soc?.logoUrl, "| supabase configuré:", !!supabase, "| bucket:", bucket);
    if (soc?.logoUrl) {
      // Sanitize path: decode URL-encoded chars, normalize with posix to collapse all traversals
      let decoded = soc.logoUrl;
      try { decoded = decodeURIComponent(decoded); decoded = decodeURIComponent(decoded); } catch { /* ignore */ }
      const normalized = nodePath.posix.normalize(decoded.replace(/\0/g, "")).replace(/^\/+/, "");
      if (normalized.startsWith("..")) { throw new Error("Path traversal detected"); }
      const cleanPath = normalized;
      console.log("[pdf] cleanPath logo:", cleanPath);
      try {
        // Résoudre le chemin de stockage : chemin relatif ou URL Supabase complète
        let storagePath = cleanPath;
        if (cleanPath.startsWith("http")) {
          // Extraire le chemin depuis une URL Supabase (upload/sign, sign, ou public)
          const m = cleanPath.match(/\/storage\/v1\/object\/(?:upload\/sign\/|sign\/|public\/)[^/]+\/(.+?)(?:\?|$)/);
          storagePath = m ? m[1] : "";
          console.log("[pdf] URL Supabase détectée, chemin extrait:", storagePath);
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
            console.log("[pdf] Logo chargé (" + ab.byteLength + " bytes)");
          } else {
            console.warn("[pdf] Logo: blob null sans erreur pour", storagePath);
          }
        } else if (!storagePath) {
          console.warn("[pdf] Impossible d'extraire le chemin depuis:", cleanPath);
        }
      } catch (logoErr) {
        console.error("[pdf] Exception logo:", logoErr);
      }
    }

    // 7. Calcul du solde précédent (factures impayées du même bail)
    let previousBalance = 0;
    if (invoice.lease?.id) {
      const unpaid = await prisma.invoice.findMany({
        where: {
          societyId,
          leaseId: invoice.lease.id,
          id: { not: invoice.id },
          status: { in: ["EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE"] },
        },
        select: { totalTTC: true, payments: { select: { amount: true } } },
      });
      previousBalance = unpaid.reduce((sum, inv) => {
        const paid = inv.payments.reduce((a, pp) => a + pp.amount, 0);
        return sum + (inv.totalTTC - paid);
      }, 0);
    }

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

    // 8b. Correction de la date d'émission si elle est dans le futur (bug historique)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (invoice.issueDate > today && ["EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE"].includes(invoice.status)) {
      const newIssueDate = new Date();
      newIssueDate.setHours(0, 0, 0, 0);
      await prisma.invoice.update({ where: { id }, data: { issueDate: newIssueDate } });
      pdfData.issueDate = newIssueDate.toISOString();
      console.warn("[pdf] issueDate corrigé de", invoice.issueDate.toISOString(), "à", newIssueDate.toISOString());
      await createAuditLog({
        societyId,
        userId: session.user.id,
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
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ _-]/g, "").replace(/\s+/g, "_").slice(0, 60);
    const lotAddr = lot?.building?.addressLine1 ?? "";
    const pdfFileName = [invoice.invoiceNumber, sanitize(lotAddr), sanitize(tenantName)].filter(Boolean).join("_") + ".pdf";
    const year = new Date(invoice.issueDate).getFullYear();
    const pdfPath = `invoices/${societyId}/${year}/${pdfFileName}`;
    if (supabase) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).upload(pdfPath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
        await prisma.invoice.update({ where: { id }, data: { fileUrl: pdfPath } });
      } catch (uploadError) {
        console.error("[pdf] Échec upload Supabase:", uploadError);
        // On continue quand même — le PDF sera renvoyé au client
      }
    }

    // 11. Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "GENERATE_PDF",
      entity: "Invoice",
      entityId: id,
      details: { invoiceNumber: invoice.invoiceNumber },
    });

    // 12. Réponse
    const filename = pdfFileName;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: { code: "FORBIDDEN", message: error.message } }, { status: 403 });
    console.error("[pdf]", error);
    return NextResponse.json(
      { error: { code: "PDF_ERROR", message: "Erreur lors de la génération du PDF" } },
      { status: 500 }
    );
  }
}
