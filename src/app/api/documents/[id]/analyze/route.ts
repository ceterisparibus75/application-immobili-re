import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";
import { analyzeDocument } from "@/lib/document-ai";

export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Appel interne depuis upload via x-cron-secret, ou appel utilisateur authentifié
    const cronHeader = req.headers.get("x-cron-secret");
    const { verifyCronSecret } = await import("@/lib/cron-auth");
    const isInternal = verifyCronSecret(cronHeader);

    let societyFilter: { societyId: string } | Record<string, never> = {};
    if (!isInternal) {
      const session = await auth();
      if (!session?.user?.id)
        return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

      const cookieStore = await cookies();
      const societyId = cookieStore.get("active-society-id")?.value;
      if (!societyId)
        return NextResponse.json({ error: "Societe non selectionnee" }, { status: 400 });

      await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
      societyFilter = { societyId };
    }

    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: { id, ...societyFilter },
      select: { id: true, storagePath: true, mimeType: true, category: true, aiStatus: true },
    });
    if (!doc)
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    if (!doc.storagePath)
      return NextResponse.json({ error: "Chemin fichier manquant" }, { status: 400 });

    // Marquer comme en cours
    await prisma.document.update({ where: { id }, data: { aiStatus: "pending" } });

    // Télécharger depuis Supabase
    const supabase = getSupabase();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const { data: blob, error: dlError } = await supabase.storage.from(bucket).download(doc.storagePath);
    if (dlError || !blob)
      throw new Error("Impossible de telecharger le fichier: " + (dlError?.message ?? "inconnu"));

    const fileBuffer = Buffer.from(await blob.arrayBuffer());
    const mimeType = doc.mimeType ?? "application/pdf";

    // Analyse IA
    const { summary, tags, metadata } = await analyzeDocument(fileBuffer, mimeType, doc.category ?? null);

    // Sauvegarder
    await prisma.document.update({
      where: { id },
      data: {
        aiSummary: summary,
        aiTags: tags,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aiMetadata: metadata as any,
        aiAnalyzedAt: new Date(),
        aiStatus: "done",
      },
    });

    return NextResponse.json({ success: true, summary, tags, metadata });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[analyze-document]", error);
    try {
      const { id } = await params;
      await prisma.document.update({ where: { id }, data: { aiStatus: "error" } });
    } catch { /* ignore */ }
    return NextResponse.json({ error: "Erreur lors de l analyse" }, { status: 500 });
  }
}
