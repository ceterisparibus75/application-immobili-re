import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;

// Upload en chunks : le client découpe le fichier en morceaux <3 Mo pour rester
// sous la limite Vercel de 4.5 Mo. Chaque chunk est envoyé en base64 dans un JSON.
// Le dernier chunk déclenche l'assemblage côté Supabase.

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

    const body = (await req.json()) as {
      fileName: string;
      chunkIndex: number;
      totalChunks: number;
      data: string; // base64
      uploadId: string;
    };

    const { fileName, chunkIndex, totalChunks, data, uploadId } = body;
    if (!data || !uploadId) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const supabase = getSupabase();

    if (totalChunks === 1) {
      // Fichier en un seul morceau (< 3 Mo)
      const buffer = Buffer.from(data, "base64");
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `temp/${societyId}/import/${uploadId}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

      if (upErr) {
        console.error("[import/upload] single upload error", upErr);
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      return NextResponse.json({ storagePath, complete: true });
    }

    // Multi-chunk : stocker chaque morceau séparément
    const chunkPath = `temp/${societyId}/import/${uploadId}_chunk_${chunkIndex}`;
    const buffer = Buffer.from(data, "base64");

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(chunkPath, buffer, { contentType: "application/pdf", upsert: false });

    if (upErr) {
      console.error("[import/upload] chunk upload error", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Si c'est le dernier chunk, assembler tous les morceaux
    if (chunkIndex === totalChunks - 1) {
      const chunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const cPath = `temp/${societyId}/import/${uploadId}_chunk_${i}`;
        const { data: cData, error: dlErr } = await supabase.storage.from(bucket).download(cPath);
        if (dlErr || !cData) {
          console.error("[import/upload] chunk download error", i, dlErr);
          return NextResponse.json({ error: `Erreur assemblage chunk ${i}` }, { status: 500 });
        }
        chunks.push(Buffer.from(await cData.arrayBuffer()));
      }

      const fullBuffer = Buffer.concat(chunks);
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `temp/${societyId}/import/${uploadId}_${safeName}`;

      const { error: finalErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fullBuffer, { contentType: "application/pdf", upsert: false });

      if (finalErr) {
        console.error("[import/upload] final upload error", finalErr);
        return NextResponse.json({ error: finalErr.message }, { status: 500 });
      }

      // Supprimer les chunks temporaires
      const chunkPaths = Array.from({ length: totalChunks }, (_, i) =>
        `temp/${societyId}/import/${uploadId}_chunk_${i}`
      );
      void supabase.storage.from(bucket).remove(chunkPaths).catch(() => null);

      return NextResponse.json({ storagePath, complete: true });
    }

    return NextResponse.json({ complete: false, chunkIndex });
  } catch (error) {
    console.error("[import/upload]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
