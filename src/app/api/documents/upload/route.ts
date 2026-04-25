import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";
import {
  isAiSupportedDocumentMimeType,
  validateDocumentUploadMetadata,
  verifyDocumentMagicBytes,
} from "@/lib/document-upload-security";

export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
    if (context instanceof NextResponse) return context;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string | null;
    const description = formData.get("description") as string | null;
    const expiresAt = formData.get("expiresAt") as string | null;
    const buildingId = formData.get("buildingId") as string | null;
    const lotId = formData.get("lotId") as string | null;
    const leaseId = formData.get("leaseId") as string | null;
    const tenantId = formData.get("tenantId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    const metadataValidation = validateDocumentUploadMetadata({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    if (!metadataValidation.ok) {
      return NextResponse.json({ error: metadataValidation.error }, { status: 400 });
    }

    // Vérification magic bytes (anti-spoofing MIME)
    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!verifyDocumentMagicBytes(headerBytes, metadataValidation.mimeType)) {
      return NextResponse.json(
        { error: "Le contenu du fichier ne correspond pas au type déclaré" },
        { status: 400 }
      );
    }

    const entityFolder = buildingId
      ? `buildings/${buildingId}`
      : lotId
        ? `lots/${lotId}`
        : leaseId
          ? `leases/${leaseId}`
          : tenantId
            ? `tenants/${tenantId}`
            : "general";

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const resolvedStoragePath = `documents/${context.societyId}/${entityFolder}/${timestamp}_${safeName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .upload(resolvedStoragePath, fileBuffer, { contentType: metadataValidation.mimeType, upsert: false });

    if (uploadError) {
      console.error("[documents/upload] upload error", uploadError);
      return NextResponse.json({ error: "Erreur lors de l upload" }, { status: 500 });
    }

    const { data: urlData } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .createSignedUrl(resolvedStoragePath, 24 * 3600); // 24h — re-generated on each access via /api/storage/view

    const fileUrl = urlData?.signedUrl ?? resolvedStoragePath;

    const doc = await prisma.document.create({
      data: {
        societyId: context.societyId,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        mimeType: metadataValidation.mimeType,
        category: category ?? "autre",
        description: description || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        buildingId: buildingId || null,
        lotId: lotId || null,
        leaseId: leaseId || null,
        tenantId: tenantId || null,
        storagePath: resolvedStoragePath,
        aiStatus: isAiSupportedDocumentMimeType(metadataValidation.mimeType) ? "pending" : null,
      },
    });

    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Document",
      entityId: doc.id,
      details: { fileName: file.name, category, buildingId, lotId, leaseId, tenantId },
    });

    // Déclencher l analyse IA en arrière-plan pour les types supportés
    if (isAiSupportedDocumentMimeType(metadataValidation.mimeType)) {
      const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      void fetch(`${baseUrl}/api/documents/${doc.id}/analyze`, {
        method: "POST",
        headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
      }).catch(() => null);
    }

    return NextResponse.json({ success: true, document: { id: doc.id, fileUrl } });
  } catch (error) {
    console.error("[documents/upload]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
