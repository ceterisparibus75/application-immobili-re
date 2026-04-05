/**
 * API publique d'accès à une dataroom — aucune authentification requise.
 * Valide le token, vérifie le mot de passe si applicable, enregistre l'accès,
 * retourne les URLs signées des documents.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { sendDataroomAccessEmail } from "@/lib/email";
import { getApiRatelimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limiting par IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1";
  const limiter = getApiRatelimit();
  const { success: rateLimitOk } = await limiter.limit(ip);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans quelques instants." },
      { status: 429 }
    );
  }

  const dataroom = await prisma.dataroom.findUnique({
    where: { shareToken: token },
    include: {
      documents: {
        orderBy: { sortOrder: "asc" },
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
      creator: { select: { email: true } },
    },
  });

  if (!dataroom || dataroom.status !== "ACTIF") {
    return NextResponse.json({ error: "Dataroom introuvable ou inactive" }, { status: 404 });
  }

  if (dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Cette dataroom a expiré" }, { status: 410 });
  }

  // Vérification du mot de passe si protégée
  if (dataroom.password) {
    const authHeader = req.headers.get("x-dataroom-password");
    if (!authHeader) {
      return NextResponse.json({ error: "Mot de passe requis", requiresPassword: true }, { status: 401 });
    }
    const valid = await bcrypt.compare(authHeader, dataroom.password);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe incorrect", requiresPassword: true }, { status: 401 });
    }
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
        sortOrder: dd.sortOrder,
      };
    })
  );

  // Enregistrer l'accès + incrémenter le compteur
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  await Promise.all([
    prisma.dataroomAccess.create({
      data: { dataroomId: dataroom.id, ipAddress: clientIp },
    }),
    prisma.dataroom.update({
      where: { id: dataroom.id },
      data: { accessCount: { increment: 1 } },
    }),
  ]);

  // Notifier le créateur par email (non bloquant)
  if (dataroom.creator?.email) {
    const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://app.example.com";
    void sendDataroomAccessEmail({
      to: dataroom.creator.email,
      dataroomName: dataroom.name,
      viewerIp: ip,
      viewerEmail: null,
      accessedAt: new Date().toLocaleString("fr-FR"),
      dataroomUrl: `${appUrl}/dataroom/${dataroom.id}`,
    }).catch((err) => console.error("[dataroom] email notification failed:", err));
  }

  return NextResponse.json({
    id: dataroom.id,
    name: dataroom.name,
    description: dataroom.description,
    expiresAt: dataroom.expiresAt,
    documents,
  });
}
