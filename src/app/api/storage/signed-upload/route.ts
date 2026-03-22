import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { filename } = await req.json();
    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "Nom de fichier requis" }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `temp/${session.user.id}/${timestamp}_${safeName}`;

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      const msg = error?.message ?? "Réponse vide de Supabase Storage";
      console.error("[signed-upload] supabase error", msg, "bucket:", process.env.SUPABASE_STORAGE_BUCKET ?? "documents");
      return NextResponse.json({ error: `Impossible de créer l'URL d'upload : ${msg}` }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
  } catch (error) {
    console.error("[signed-upload]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
