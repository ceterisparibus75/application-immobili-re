import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Stockage non configure" }, { status: 503 });
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
      const cookieStore = await cookies();
      const activeSocietyId = cookieStore.get("active-society-id")?.value;
      if (!activeSocietyId || activeSocietyId !== societyId) {
        return NextResponse.json({ error: "Societe non autorisee" }, { status: 403 });
      }
      await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
      storagePath = `documents/${societyId}/${entityFolder}/${timestamp}_${safeName}`;
    } else if (societyId) {
      storagePath = `logos/${societyId}/${timestamp}_${safeName}`;
    } else {
      storagePath = `temp/${session.user.id}/${timestamp}_${safeName}`;
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

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
      storagePath,
      contentType: contentType ?? null,
      anonKey,
    });
  } catch (error) {
    console.error("[signed-upload]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
