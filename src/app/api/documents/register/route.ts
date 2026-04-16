import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";

const AI_SUPPORTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

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
    };

    const { fileName, fileSize, mimeType, storagePath, category, description, expiresAt,
      buildingId, lotId, leaseId, tenantId } = body;

    if (!fileName || !storagePath) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    // Générer une URL signée longue durée pour la consultation
    let fileUrl = storagePath;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 24 * 3600); // 24h
      if (data?.signedUrl) fileUrl = data.signedUrl;
    }

    const doc = await prisma.document.create({
      data: {
        societyId,
        fileName,
        fileUrl,
        fileSize: fileSize ?? 0,
        mimeType: mimeType ?? null,
        category: category ?? "autre",
        description: description || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        buildingId: buildingId || null,
        lotId: lotId || null,
        leaseId: leaseId || null,
        tenantId: tenantId || null,
        storagePath,
        aiStatus: AI_SUPPORTED_TYPES.includes(mimeType ?? "") ? "pending" : null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Document",
      entityId: doc.id,
      details: { fileName, category, buildingId, lotId, leaseId, tenantId },
    });

    // Déclencher l'analyse IA en arrière-plan
    if (AI_SUPPORTED_TYPES.includes(mimeType ?? "")) {
      const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      void fetch(`${baseUrl}/api/documents/${doc.id}/analyze`, {
        method: "POST",
        headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
      }).catch(() => null);
    }

    return NextResponse.json({ success: true, document: { id: doc.id, fileUrl } });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[documents/register]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
