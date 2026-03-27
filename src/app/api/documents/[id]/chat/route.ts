import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";
import { chatWithDocument } from "@/lib/document-ai";

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
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

    const { id } = await params;
    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId)
      return NextResponse.json({ error: "Societe non selectionnee" }, { status: 400 });

    await requireSocietyAccess(session.user.id, societyId, "LECTURE");

    const doc = await prisma.document.findFirst({
      where: { id, societyId },
      select: { storagePath: true, mimeType: true },
    });
    if (!doc || !doc.storagePath)
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    const body = await req.json() as { messages: Array<{ role: string; content: string }> };
    const messages = (body.messages ?? []).filter(
      (m) => m.role === "user" || m.role === "assistant"
    ) as Array<{ role: "user" | "assistant"; content: string }>;

    if (messages.length === 0)
      return NextResponse.json({ error: "Aucun message" }, { status: 400 });

    const supabase = getSupabase();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const { data: blob, error: dlError } = await supabase.storage.from(bucket).download(doc.storagePath);
    if (dlError || !blob)
      return NextResponse.json({ error: "Impossible de charger le document" }, { status: 500 });

    const fileBuffer = Buffer.from(await blob.arrayBuffer());
    const reply = await chatWithDocument(fileBuffer, doc.mimeType ?? "application/pdf", messages);

    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[document-chat]", error);
    return NextResponse.json({ error: "Erreur lors du chat" }, { status: 500 });
  }
}
