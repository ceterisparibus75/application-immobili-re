import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { filename, contentType, societyId } = await req.json();
    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "Nom de fichier requis" }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Logos de société dans logos/, autres fichiers dans temp/
    const storagePath = societyId
      ? `logos/${societyId}/${timestamp}_${safeName}`
      : `temp/${session.user.id}/${timestamp}_${safeName}`;

    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      const msg = error?.message ?? "Réponse vide de Supabase Storage";
      console.error("[signed-upload] supabase error", msg, "bucket:", bucket);
      return NextResponse.json({ error: `Impossible de créer l'URL d'upload : ${msg}` }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
      contentType: contentType ?? null,
    });
  } catch (error) {
    console.error("[signed-upload]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
