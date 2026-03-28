/**
 * API publique d'accès à une dataroom — aucune authentification requise.
 * Valide le token, enregistre l'accès, retourne les URLs signées des documents.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const dataroom = await prisma.dataroom.findUnique({
    where: { token },
    include: {
      documents: {
        orderBy: { order: "asc" },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              category: true,
              description: true,
              storagePath: true,
            },
          },
        },
      },
    },
  });

  if (!dataroom || !dataroom.isActive) {
    return NextResponse.json({ error: "Dataroom introuvable ou inactive" }, { status: 404 });
  }

  if (dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Cette dataroom a expiré" }, { status: 410 });
  }

  // Générer des URLs signées courte durée (1h) pour chaque document
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

  const documents = await Promise.all(
    dataroom.documents.map(async (dd) => {
      let signedUrl: string | null = null;

      if (dd.document.storagePath && supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(dd.document.storagePath, 3600); // 1 heure
        signedUrl = data?.signedUrl ?? null;
      }

      return {
        id: dd.document.id,
        fileName: dd.document.fileName,
        fileSize: dd.document.fileSize,
        mimeType: dd.document.mimeType,
        category: dd.document.category,
        description: dd.document.description,
        signedUrl,
        order: dd.order,
      };
    })
  );

  // Enregistrer l'accès + incrémenter le compteur
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent") ?? null;

  await Promise.all([
    prisma.dataroomAccess.create({
      data: { dataroomId: dataroom.id, ipAddress: ip, userAgent },
    }),
    prisma.dataroom.update({
      where: { id: dataroom.id },
      data: { viewCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({
    id: dataroom.id,
    name: dataroom.name,
    description: dataroom.description,
    expiresAt: dataroom.expiresAt,
    documents,
  });
}
