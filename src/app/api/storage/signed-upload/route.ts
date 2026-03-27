import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
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

    const { filename, contentType, societyId, entityFolder } = await req.json() as {
      filename: string;
      contentType?: string;
      societyId?: string;
      entityFolder?: string;
    };

    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "Nom de fichier requis" }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

    let storagePath: string;

    if (societyId && entityFolder !== undefined) {
      // Upload document GED — vérifier l'accès à la société
      const cookieStore = await cookies();
      const activeSocietyId = cookieStore.get("active-society-id")?.value;
      if (!activeSocietyId || activeSocietyId !== societyId) {
        return NextResponse.json({ error: "Société non autorisée" }, { status: 403 });
      }
      await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
      storagePath = `documents/${societyId}/${entityFolder}/${timestamp}_${safeName}`;
    } else if (societyId) {
      // Logo de société
      storagePath = `logos/${societyId}/${timestamp}_${safeName}`;
    } else {
      storagePath = `temp/${session.user.id}/${timestamp}_${safeName}`;
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      const msg = error?.message ?? "Réponse vide de Supabase Storage";
      console.error("[signed-upload] supabase error", msg, "bucket:", bucket);
      return NextResponse.json(
        { error: `Impossible de créer l'URL d'upload : ${msg}` },
        { status: 500 }
      );
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
