import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

// Upload proxy : le client envoie le PDF en streaming (application/octet-stream),
// cette route le transmet directement à Supabase sans le bufferiser (contourne
// la limite Vercel de 4.5 Mo, même pattern que /api/documents/upload-stream).

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
    }

    if (!req.body) {
      return NextResponse.json({ error: "Corps de requête vide" }, { status: 400 });
    }

    const fileName = decodeURIComponent(req.headers.get("x-filename") ?? "document.pdf");
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `temp/${societyId}/import/${timestamp}_${safeName}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

    const supabase = getSupabase();

    // Stream directement vers Supabase sans bufferiser (contourne Vercel 4.5 Mo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: uploadError } = await (supabase.storage.from(bucket) as any).upload(
      storagePath,
      req.body,
      { contentType: "application/pdf", duplex: "half", upsert: false }
    );

    if (uploadError) {
      console.error("[import/upload] supabase error", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'upload: " + uploadError.message }, { status: 500 });
    }

    return NextResponse.json({ storagePath });
  } catch (error) {
    console.error("[import/upload]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
