import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";
import { chatWithDocument } from "@/lib/document-ai";
import { env } from "@/lib/env";

export const maxDuration = 60;

function getSupabase() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "LECTURE" });
    if (context instanceof NextResponse) return context;
    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: { id, societyId: context.societyId },
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
    if (!supabase) {
      return NextResponse.json({ error: "Stockage non configuré" }, { status: 500 });
    }
    const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";
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
