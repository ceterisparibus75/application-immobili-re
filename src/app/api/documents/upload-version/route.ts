import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { validateDocumentUploadMetadata } from "@/lib/document-upload-security";

export async function POST(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
    if (context instanceof NextResponse) return context;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const parentDocumentId = formData.get("parentDocumentId") as string | null;

    if (!file || !parentDocumentId) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const parent = await prisma.document.findFirst({
      where: { id: parentDocumentId, societyId: context.societyId, deletedAt: null, versionOf: null },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!parent) return NextResponse.json({ error: "Document parent introuvable" }, { status: 404 });

    const meta = validateDocumentUploadMetadata({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storagePath: "",
      societyId: context.societyId,
    });
    if (!meta.ok) return NextResponse.json({ error: meta.error }, { status: 400 });

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `documents/${context.societyId}/versions/${Date.now()}_${safeName}`;

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType: file.type });
    if (uploadError) return NextResponse.json({ error: "Erreur upload" }, { status: 500 });

    const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 24 * 3600);
    const fileUrl = signedData?.signedUrl ?? storagePath;

    const latestVersion = parent.versions[0]?.versionNumber ?? parent.versionNumber;
    const nextVersion = latestVersion + 1;

    const version = await prisma.document.create({
      data: {
        societyId: context.societyId,
        versionOf: parentDocumentId,
        versionNumber: nextVersion,
        fileName: file.name,
        fileUrl,
        storagePath,
        fileSize: file.size,
        mimeType: meta.mimeType,
        category: parent.category ?? "autre",
        description: parent.description,
        buildingId: parent.buildingId,
        lotId: parent.lotId,
        leaseId: parent.leaseId,
        tenantId: parent.tenantId,
      },
    });

    await createAuditLog({
      societyId: context.societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Document",
      entityId: version.id,
      details: { type: "version", parentId: parentDocumentId, versionNumber: nextVersion, fileName: file.name },
    });

    return NextResponse.json({ success: true, version: { id: version.id, versionNumber: nextVersion } });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[documents/upload-version]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
