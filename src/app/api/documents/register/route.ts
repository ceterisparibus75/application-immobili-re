import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  isAiSupportedDocumentMimeType,
  validateDocumentUploadMetadata,
} from "@/lib/document-upload-security";
import { resolveDocumentLeaseAssociation } from "@/lib/document-lease-association";
import { extractAndStoreFullText } from "@/lib/document-fulltext";

export async function POST(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
    if (context instanceof NextResponse) return context;

    const body = await req.json() as {
      fileName: string;
      fileSize: number;
      mimeType: string;
      storagePath: string;
      category?: string;
      description?: string;
      expiresAt?: string;
      buildingId?: string;
      lotId?: string;
      leaseId?: string;
      tenantId?: string;
      syncLeasePdf?: boolean;
    };

    const { fileName, fileSize, mimeType, storagePath, category, description, expiresAt,
      buildingId, lotId, leaseId, tenantId, syncLeasePdf } = body;

    if (!fileName || !storagePath) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }
    const metadataValidation = validateDocumentUploadMetadata({
      fileName,
      fileSize,
      mimeType,
      storagePath,
      societyId: context.societyId,
    });
    if (!metadataValidation.ok) {
      return NextResponse.json({ error: metadataValidation.error }, { status: 400 });
    }

    // Générer une URL signée longue durée pour la consultation
    let fileUrl = storagePath;
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 24 * 3600); // 24h
      if (data?.signedUrl) fileUrl = data.signedUrl;
    }

    const association = await resolveDocumentLeaseAssociation({
      societyId: context.societyId,
      category,
      mimeType: metadataValidation.mimeType,
      buildingId,
      lotId,
      leaseId,
      tenantId,
      syncLeasePdf,
    });

    const doc = await prisma.document.create({
      data: {
        societyId: context.societyId,
        fileName,
        fileUrl,
        fileSize,
        mimeType: metadataValidation.mimeType,
        category: category ?? "autre",
        description: description || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        buildingId: association.buildingId,
        lotId: association.lotId,
        leaseId: association.leaseId,
        tenantId: association.tenantId,
        storagePath,
        aiStatus: isAiSupportedDocumentMimeType(metadataValidation.mimeType) ? "pending" : null,
      },
    });

    if (association.shouldSyncLeasePdf && association.leaseId) {
      await prisma.lease.update({
        where: { id: association.leaseId },
        data: { leaseFileUrl: fileUrl, leaseFileStoragePath: storagePath },
      });
    }

    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Document",
      entityId: doc.id,
      details: { fileName, category, buildingId: association.buildingId, lotId: association.lotId, leaseId: association.leaseId, tenantId: association.tenantId },
    });

    // Déclencher l'analyse IA en arrière-plan
    if (isAiSupportedDocumentMimeType(metadataValidation.mimeType)) {
      const baseUrl = env.AUTH_URL ?? "http://localhost:3000";
      void fetch(`${baseUrl}/api/documents/${doc.id}/analyze`, {
        method: "POST",
        headers: { "x-cron-secret": env.CRON_SECRET ?? "" },
      }).catch(() => null);
    }

    // Extraction plein texte PDF en arrière-plan
    if (metadataValidation.mimeType === "application/pdf") {
      void extractAndStoreFullText(doc.id, storagePath);
    }

    return NextResponse.json({ success: true, document: { id: doc.id, fileUrl } });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[documents/register]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}