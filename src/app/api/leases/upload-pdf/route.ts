import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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
    const leaseId = formData.get("leaseId") as string | null;

    if (!file || !leaseId) {
      return NextResponse.json({ error: "Fichier et ID du bail requis" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 400 });
    }

    // Vérifier que le bail appartient à la société
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId },
    });
    if (!lease) {
      return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const storagePath = `leases/${societyId}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("[lease/upload-pdf] upload error", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
    }

    const { data: urlData } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .createSignedUrl(storagePath, 365 * 24 * 3600);

    const fileUrl = urlData?.signedUrl ?? null;

    await prisma.lease.update({
      where: { id: leaseId },
      data: { leaseFileUrl: fileUrl, leaseFileStoragePath: storagePath },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Lease",
      entityId: leaseId,
      details: { action: "upload_pdf", fileName: file.name },
    });

    return NextResponse.json({ success: true, fileUrl });
  } catch (error) {
    console.error("[lease/upload-pdf]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
