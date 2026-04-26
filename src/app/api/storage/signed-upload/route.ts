import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedRouteContext } from "@/lib/api-auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";
import * as nodePath from "path";
import { env } from "@/lib/env";
import { validateDocumentUploadMetadata, validateLogoUploadMetadata } from "@/lib/document-upload-security";

function sanitizeFolderPath(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(decoded);
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep raw value if decoding fails
  }

  decoded = decoded.replace(/\0/g, "");
  const normalized = nodePath.posix.normalize(decoded).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized || normalized === "." || normalized.startsWith("..") || normalized.includes("/../")) {
    return null;
  }

  return normalized;
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireAuthenticatedRouteContext();
    if (context instanceof NextResponse) return context;

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY ?? "";
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Stockage non configure" }, { status: 503 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { filename, contentType, mimeType, fileSize, societyId, entityFolder } = await req.json() as {
      filename: string;
      contentType?: string;
      mimeType?: string;
      fileSize?: number;
      societyId?: string;
      entityFolder?: string;
    };

    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "Nom de fichier requis" }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

    let storagePath: string;
    let normalizedContentType = contentType ?? mimeType ?? null;

    if (societyId && entityFolder !== undefined) {
      const cleanEntityFolder = sanitizeFolderPath(entityFolder);
      if (!cleanEntityFolder) {
        return NextResponse.json({ error: "Dossier cible invalide" }, { status: 400 });
      }

      const metadataValidation = validateDocumentUploadMetadata({
        fileName: filename,
        fileSize,
        mimeType: mimeType ?? contentType,
      });
      if (!metadataValidation.ok) {
        return NextResponse.json({ error: metadataValidation.error }, { status: 400 });
      }
      normalizedContentType = metadataValidation.mimeType;

      const cookieStore = await cookies();
      const activeSocietyId = cookieStore.get("active-society-id")?.value;
      if (!activeSocietyId || activeSocietyId !== societyId) {
        return NextResponse.json({ error: "Societe non autorisee" }, { status: 403 });
      }
      await requireSocietyAccess(context.userId, societyId, "GESTIONNAIRE");
      storagePath = `documents/${societyId}/${cleanEntityFolder}/${timestamp}_${safeName}`;
    } else if (societyId) {
      const logoValidation = validateLogoUploadMetadata({
        fileName: filename,
        fileSize,
        mimeType: mimeType ?? contentType,
      });
      if (!logoValidation.ok) {
        return NextResponse.json({ error: logoValidation.error }, { status: 400 });
      }
      normalizedContentType = logoValidation.mimeType;
      await requireSocietyAccess(context.userId, societyId, "ADMIN_SOCIETE");
      storagePath = `logos/${societyId}/${timestamp}_${safeName}`;
    } else {
      storagePath = `temp/${context.userId}/${timestamp}_${safeName}`;
    }

    const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";

    // Auto-creer le bucket s'il n'existe pas
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === bucket);
    if (!bucketExists) {
      const { error: createErr } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 52428800,
      });
      if (createErr && !createErr.message.includes("already exists")) {
        console.error("[signed-upload] createBucket error", createErr);
        return NextResponse.json({ error: "Impossible de creer le bucket de stockage" }, { status: 500 });
      }
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      const msg = error?.message ?? "Reponse vide de Supabase Storage";
      console.error("[signed-upload] supabase error", msg, "bucket:", bucket);
      return NextResponse.json(
        { error: `Impossible de creer l'URL d'upload : ${msg}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
      bucket,
      contentType: normalizedContentType,
      anonKey,
      supabaseUrl,
    });
  } catch (error) {
    console.error("[signed-upload]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
