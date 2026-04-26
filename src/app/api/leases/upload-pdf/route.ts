import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  validateDocumentUploadMetadata,
  verifyDocumentMagicBytes,
} from "@/lib/document-upload-security";

export async function POST(req: NextRequest) {
  try {
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Stockage non configuré" }, { status: 500 });
    }
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
    if (context instanceof NextResponse) return context;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const leaseId = formData.get("leaseId") as string | null;

    if (!file || !leaseId) {
      return NextResponse.json({ error: "Fichier et ID du bail requis" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 400 });
    }

    const metadataValidation = validateDocumentUploadMetadata({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    if (!metadataValidation.ok || metadataValidation.mimeType !== "application/pdf") {
      return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés" }, { status: 400 });
    }

    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!verifyDocumentMagicBytes(headerBytes, metadataValidation.mimeType)) {
      return NextResponse.json({ error: "Le contenu du fichier ne correspond pas au type PDF" }, { status: 400 });
    }

    // Vérifier que le bail appartient à la société
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId: context.societyId },
      select: {
        id: true,
        societyId: true,
        lotId: true,
        tenantId: true,
      },
    });
    if (!lease) {
      return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const storagePath = `leases/${context.societyId}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("[lease/upload-pdf] upload error", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
    }

    const { data: urlData } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .createSignedUrl(storagePath, 24 * 3600); // 24h

    const fileUrl = urlData?.signedUrl ?? null;

    await prisma.lease.update({
      where: { id: leaseId },
      data: { leaseFileUrl: fileUrl, leaseFileStoragePath: storagePath },
    });

    const document = await prisma.document.create({
      data: {
        societyId: context.societyId,
        fileName: file.name,
        fileUrl: fileUrl ?? storagePath,
        fileSize: file.size,
        mimeType: metadataValidation.mimeType,
        category: "bail",
        description: "PDF du bail signé",
        leaseId: lease.id,
        lotId: lease.lotId,
        tenantId: lease.tenantId,
        storagePath,
        aiStatus: "pending",
      },
    });

    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Lease",
      entityId: leaseId,
      details: { action: "upload_pdf", fileName: file.name },
    });

    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Document",
      entityId: document.id,
      details: {
        fileName: file.name,
        category: "bail",
        leaseId: lease.id,
        lotId: lease.lotId,
        tenantId: lease.tenantId,
      },
    });

    return NextResponse.json({ success: true, fileUrl });
  } catch (error) {
    console.error("[lease/upload-pdf]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
