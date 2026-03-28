import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) return NextResponse.json({ error: "Aucune société active" }, { status: 401 });

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const { filename, mimeType, fileSize, entityFolder } = await req.json() as {
      filename: string; mimeType: string; fileSize: number; entityFolder: string;
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `documents/${societyId}/${entityFolder}/${timestamp}_${safeName}`;

    const metadata = [
      `bucketName ${Buffer.from(bucket).toString("base64")}`,
      `objectName ${Buffer.from(storagePath).toString("base64")}`,
      `contentType ${Buffer.from(mimeType || "application/octet-stream").toString("base64")}`,
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
      return NextResponse.json({ error: `TUS create ${tusRes.status}: ${msg}` }, { status: 500 });
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
