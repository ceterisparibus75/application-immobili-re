import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

// Ce contournement permet d’uploader des fichiers >4.5 Mo sur Vercel :
// le body est lu en streaming (ReadableStream) et transmis directement
// à Supabase sans jamais être bufferisé en mémoire par Vercel.

const AI_SUPPORTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId)
      return NextResponse.json({ error: "Aucune société active" }, { status: 401 });

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    // Métadonnées dans les headers (le body = fichier brut)
    const fileName = decodeURIComponent(req.headers.get("x-filename") ?? "");
    const fileSize  = parseInt(req.headers.get("x-filesize") ?? "0", 10);
    const mimeType  = req.headers.get("content-type") ?? "application/octet-stream";
    const category  = req.headers.get("x-category") || "autre";
    const entityType = req.headers.get("x-entity-type") || "";
    const buildingId = req.headers.get("x-building-id") || null;
    const lotId      = req.headers.get("x-lot-id") || null;
    const leaseId    = req.headers.get("x-lease-id") || null;
    const tenantId   = req.headers.get("x-tenant-id") || null;
    const description = req.headers.get("x-description") || null;
    const expiresAt   = req.headers.get("x-expires-at") || null;

    if (!fileName) return NextResponse.json({ error: "Nom de fichier manquant" }, { status: 400 });
    if (!req.body) return NextResponse.json({ error: "Corps de requête vide" }, { status: 400 });

    const entityFolder = entityType === "building" && buildingId ? "buildings/" + buildingId
      : entityType === "lot" && lotId ? "lots/" + lotId
      : entityType === "lease" && leaseId ? "leases/" + leaseId
      : entityType === "tenant" && tenantId ? "tenants/" + tenantId
      : "general";

    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = "documents/" + societyId + "/" + entityFolder + "/" + timestamp + "_" + safeName;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

    const supabase = getSupabase();

    // Upload en streaming : le body de la requête (ReadableStream) est passé
    // directement à Supabase sans jamais être bufferisé sur Vercel.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: uploadError } = await (supabase.storage.from(bucket) as any).upload(
      storagePath,
      req.body,
      { contentType: mimeType, duplex: "half", upsert: false }
    );

    if (uploadError) {
      console.error("[upload-stream] supabase error", uploadError);
      return NextResponse.json({ error: "Erreur Supabase: " + uploadError.message }, { status: 500 });
    }

    // URL signée 365 jours pour la consultation
    let fileUrl = storagePath;
    const { data: urlData } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 24 * 3600); // 24h
    if (urlData?.signedUrl) fileUrl = urlData.signedUrl;

    const doc = await prisma.document.create({
      data: {
        societyId,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        mimeType,
        category,
        description: description || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        buildingId: entityType === "building" ? buildingId : null,
        lotId: entityType === "lot" ? lotId : null,
        leaseId: entityType === "lease" ? leaseId : null,
        tenantId: entityType === "tenant" ? tenantId : null,
        storagePath,
        aiStatus: AI_SUPPORTED_TYPES.includes(mimeType) ? "pending" : null,
      },
    });

    await createAuditLog({
      societyId, userId: session.user.id, action: "CREATE", entity: "Document", entityId: doc.id,
      details: { fileName, category, buildingId, lotId, leaseId, tenantId },
    });

    if (AI_SUPPORTED_TYPES.includes(mimeType)) {
      const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      void fetch(baseUrl + "/api/documents/" + doc.id + "/analyze", {
        method: "POST", headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
      }).catch(() => null);
    }

    return NextResponse.json({ success: true, document: { id: doc.id, fileUrl } });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[upload-stream]", error);
    return NextResponse.json({ error: "Erreur serveur: " + String(error) }, { status: 500 });
  }
}
