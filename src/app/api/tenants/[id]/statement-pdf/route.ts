import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { getTenantAccountStatement } from "@/actions/tenant-queries";
import { buildStatementMovements, summarizeStatement } from "@/lib/tenant-statement-movements";
import { TenantStatementPdf } from "@/lib/tenant-statement-pdf";
import { buildStorageFileName } from "@/lib/storage-path";
import { getTenantDisplayName, getTenantMailingAddress } from "@/lib/tenant-format";
import * as nodePath from "path";
import React from "react";

const STORAGE_BUCKET = "documents";

function getSupabaseClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * GET /api/tenants/[id]/statement-pdf
 * Génère un décompte locatif PDF pour le locataire — reprend intégralement
 * la vue "Situation du compte locataire" (factures, paiements, virements,
 * avoirs, reprises de soldes) et ajoute un en-tête société + bloc solde.
 * Rôle minimum : COMPTABLE.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeContext = await requireActiveSocietyRouteContext({ minRole: "COMPTABLE" });
    if (routeContext instanceof NextResponse) return routeContext;
    const context = routeContext;

    const { id: tenantId } = await params;

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, societyId: context.societyId, deletedAt: null },
      include: { society: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Locataire introuvable" } }, { status: 404 });
    }

    const statement = await getTenantAccountStatement(context.societyId, tenantId);
    if (!statement) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Accès refusé" } }, { status: 403 });
    }

    // Composer les mouvements chronologiques
    const movements = buildStatementMovements(
      statement.invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        invoiceType: i.invoiceType,
        status: i.status,
        issueDate: i.issueDate.toISOString(),
        dueDate: i.dueDate.toISOString(),
        periodStart: i.periodStart?.toISOString() ?? null,
        periodEnd: i.periodEnd?.toISOString() ?? null,
        totalTTC: i.totalTTC,
      })),
      statement.adjustments.map((a) => ({
        id: a.id,
        label: a.label,
        amount: a.amount,
        dueDate: a.dueDate.toISOString(),
        reference: a.reference,
        periodLabel: a.periodLabel,
        periodStart: a.periodStart?.toISOString() ?? null,
        periodEnd: a.periodEnd?.toISOString() ?? null,
        notes: a.notes,
        balanceAfter: a.balanceAfter,
      })),
      statement.bankFlows.map((f) => ({
        id: f.id,
        transactionDate: f.transactionDate.toISOString(),
        label: f.label,
        reference: f.reference,
        transactionAmount: f.transactionAmount,
        invoiceNumbers: f.invoiceNumbers,
        adjustmentLabels: f.adjustmentLabels,
      })),
      statement.manualPayments.map((p) => ({
        id: p.id,
        paidAt: p.paidAt.toISOString(),
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        invoiceNumber: p.invoiceNumber,
      })),
    );
    const summary = summarizeStatement(movements);

    // Logo société (URL signée Supabase 5 min)
    let logoSignedUrl: string | null = null;
    const supabase = getSupabaseClient();
    const bucket = env.SUPABASE_STORAGE_BUCKET ?? STORAGE_BUCKET;
    if (tenant.society?.logoUrl && supabase) {
      let decoded = tenant.society.logoUrl;
      try { decoded = decodeURIComponent(decoded); decoded = decodeURIComponent(decoded); } catch { /* noop */ }
      const normalized = nodePath.posix.normalize(decoded.replace(/\0/g, "")).replace(/^\/+/, "");
      if (!normalized.startsWith("..")) {
        let storagePath = normalized;
        if (storagePath.startsWith("http")) {
          const m = storagePath.match(/\/storage\/v1\/object\/(?:upload\/sign\/|sign\/|public\/)[^/]+\/(.+?)(?:\?|$)/);
          storagePath = m ? m[1] : "";
        }
        if (storagePath) {
          try {
            const { data: signed, error: signErr } = await supabase.storage
              .from(bucket)
              .createSignedUrl(storagePath, 300);
            if (!signErr && signed?.signedUrl) logoSignedUrl = signed.signedUrl;
          } catch {
            // non bloquant
          }
        }
      }
    }

    const tenantName = getTenantDisplayName(tenant);
    const tenantAddress = getTenantMailingAddress(tenant);
    const issuedAt = new Date().toISOString();

    const pdfBuffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(TenantStatementPdf, {
        data: {
          tenant: { name: tenantName, address: tenantAddress || null, email: tenant.email },
          society: tenant.society
            ? {
                name: tenant.society.name,
                addressLine1: tenant.society.addressLine1,
                postalCode: tenant.society.postalCode,
                city: tenant.society.city,
                siret: tenant.society.siret,
                legalForm: tenant.society.legalForm,
                shareCapital: tenant.society.shareCapital,
                email: tenant.society.email,
                signatoryName: tenant.society.signatoryName,
                logoSignedUrl,
                legalMentions: tenant.society.legalMentions,
              }
            : null,
          movements,
          summary,
          issuedAt,
          periodLabel: null,
        },
      }) as any,
    );

    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "GENERATE_PDF",
      entity: "Tenant",
      entityId: tenantId,
      details: { kind: "tenant_statement", movements: movements.length, balance: summary.balance },
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = buildStorageFileName(
      ["decompte-locatif", tenantName, dateStr],
      "pdf",
      "decompte",
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[tenant-statement-pdf]", error);
    return NextResponse.json(
      { error: { code: "PDF_ERROR", message: "Erreur lors de la génération du décompte" } },
      { status: 500 },
    );
  }
}
