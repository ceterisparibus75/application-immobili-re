import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePortalAuth } from "@/lib/portal-auth";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const session = await requirePortalAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
    }

    // Use the specific tenantId from the JWT session — never update across all societies
    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId, email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Locataire introuvable" }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `insurance/${session.tenantId}/${timestamp}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("[upload-insurance] upload error", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
    }

    const { data: urlData } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .createSignedUrl(storagePath, 24 * 3600); // 24h

    const fileUrl = urlData?.signedUrl ?? null;

    // Only update the specific tenant from the JWT session
    await prisma.tenant.updateMany({
      where: { id: tenant.id },
      data: {
        insuranceFileUrl: fileUrl,
        insuranceStoragePath: storagePath,
        insuranceUploadedAt: new Date(),
        insuranceReminderSentAt: null,
      },
    });

    return NextResponse.json({ success: true, fileUrl });
  } catch (error) {
    console.error("[upload-insurance]", error);
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 });
  }
}
