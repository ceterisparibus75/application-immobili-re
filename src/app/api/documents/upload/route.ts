import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AI_SUPPORTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Aucune société active" }, { status: 401 });
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

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
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Format non supporté (PDF, images, Word)" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 400 });
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
    const storagePath = `documents/${societyId}/${entityFolder}/${timestamp}_${safeName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("[documents/upload] upload error", uploadError);
      return NextResponse.json({ error: "Erreur lors de l upload" }, { status: 500 });
    }

    const { data: urlData } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .createSignedUrl(storagePath, 365 * 24 * 3600);

    const fileUrl = urlData?.signedUrl ?? storagePath;

    const doc = await prisma.document.create({
      data: {
        societyId,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        category: category ?? "autre",
        description: description || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        buildingId: buildingId || null,
        lotId: lotId || null,
        leaseId: leaseId || null,
        tenantId: tenantId || null,
        storagePath,
        aiStatus: AI_SUPPORTED_TYPES.includes(file.type) ? "pending" : null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Document",
      entityId: doc.id,
      details: { fileName: file.name, category, buildingId, lotId, leaseId, tenantId },
    });

    // Déclencher l analyse IA en arrière-plan pour les types supportés
    if (AI_SUPPORTED_TYPES.includes(file.type)) {
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
