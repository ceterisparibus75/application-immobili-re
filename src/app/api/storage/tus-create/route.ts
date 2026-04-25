import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { ForbiddenError } from "@/lib/permissions";
import {
  sanitizeDocumentStorageFolder,
  validateDocumentUploadMetadata,
} from "@/lib/document-upload-security";

export async function POST(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
    if (context instanceof NextResponse) return context;

    const { filename, mimeType, fileSize, entityFolder } = await req.json() as {
      filename: string; mimeType: string; fileSize: number; entityFolder: string;
    };

    const metadataValidation = validateDocumentUploadMetadata({ fileName: filename, fileSize, mimeType });
    if (!metadataValidation.ok) {
      return NextResponse.json({ error: metadataValidation.error }, { status: 400 });
    }
    const cleanEntityFolder = sanitizeDocumentStorageFolder(entityFolder);
    if (!cleanEntityFolder) {
      return NextResponse.json({ error: "Dossier cible invalide" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Stockage non configuré (SUPABASE_SERVICE_ROLE_KEY manquante)" }, { status: 503 });
    if (serviceKey.length < 100) {
      console.error("[tus-create] SUPABASE_SERVICE_ROLE_KEY semble tronquée (longueur:", serviceKey.length, ")");
      return NextResponse.json({ error: "Clé Supabase invalide (trop courte). Régénérez-la depuis le dashboard Supabase." }, { status: 503 });
    }
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `documents/${context.societyId}/${cleanEntityFolder}/${timestamp}_${safeName}`;

    const metadata = [
      `bucketName ${Buffer.from(bucket).toString("base64")}`,
      `objectName ${Buffer.from(storagePath).toString("base64")}`,
      `contentType ${Buffer.from(metadataValidation.mimeType).toString("base64")}`,
      `cacheControl ${Buffer.from("3600").toString("base64")}`,
    ].join(",");

    const tusRes = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Length": "0",
        "Upload-Length": String(fileSize),
        "Tus-Resumable": "1.0.0",
        "Upload-Metadata": metadata,
        "x-upsert": "false",
      },
    });

    if (!tusRes.ok) {
      const msg = await tusRes.text();
      console.error("[tus-create] Supabase error", tusRes.status, msg);
      // Diagnostic : clé service_role invalide ou expirée
      if (msg.includes("Invalid Compact JWS") || msg.includes("invalid JWT") || tusRes.status === 403) {
        return NextResponse.json(
          { error: "Clé Supabase invalide ou expirée. Vérifiez SUPABASE_SERVICE_ROLE_KEY dans les variables d'environnement." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "Erreur stockage (" + tusRes.status + "): " + msg }, { status: 500 });
    }

    let tusUrl = tusRes.headers.get("Location") ?? "";
    if (tusUrl && !tusUrl.startsWith("http")) tusUrl = supabaseUrl + tusUrl;
    if (!tusUrl) return NextResponse.json({ error: "TUS: Location manquant" }, { status: 500 });

    return NextResponse.json({ tusUrl, storagePath, bucket });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[tus-create]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
