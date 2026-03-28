/**
 * Page publique d'accès à une dataroom — aucune authentification requise.
 * Valide le token, vérifie le mot de passe si applicable, génère des URLs signées.
 */
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { DataroomViewer } from "./_components/dataroom-viewer";
import { PasswordGate } from "./_components/password-gate";

export const dynamic = "force-dynamic";

async function getPublicDataroom(token: string) {
  const dataroom = await prisma.dataroom.findUnique({
    where: { token },
    include: {
      documents: {
        orderBy: { order: "asc" },
        include: {
          document: {
            select: {
              id: true, fileName: true, fileSize: true,
              mimeType: true, category: true, description: true, storagePath: true,
            },
          },
        },
      },
      createdBy: { select: { email: true } },
    },
  });

  if (!dataroom || !dataroom.isActive) return null;
  if (dataroom.expiresAt && new Date(dataroom.expiresAt) < new Date()) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

  const documents = await Promise.all(
    dataroom.documents.map(async (dd) => {
      let signedUrl: string | null = null;
      if (dd.document.storagePath && supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase.storage.from(bucket).createSignedUrl(dd.document.storagePath, 3600);
        signedUrl = data?.signedUrl ?? null;
      }
      return { ...dd.document, signedUrl, order: dd.order };
    })
  );

  return { ...dataroom, documents };
}

export default async function PublicDataroomPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Vérification rapide du token + existence
  const meta = await prisma.dataroom.findUnique({
    where: { token },
    select: { id: true, isActive: true, expiresAt: true, passwordHash: true, name: true },
  });

  if (!meta || !meta.isActive) notFound();
  if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) notFound();

  // Protection par mot de passe
  if (meta.passwordHash) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(`dr_auth_${token}`)?.value;
    if (authCookie !== "authorized") {
      return <PasswordGate token={token} dataroomName={meta.name} />;
    }
  }

  // Charger la dataroom complète avec URLs signées
  const dataroom = await getPublicDataroom(token);
  if (!dataroom) notFound();

  // Enregistrer l'accès (fire-and-forget)
  void Promise.all([
    prisma.dataroomAccess.create({ data: { dataroomId: dataroom.id } }),
    prisma.dataroom.update({ where: { id: dataroom.id }, data: { viewCount: { increment: 1 } } }),
  ]).catch(() => null);

  return <DataroomViewer dataroom={dataroom} />;
}
