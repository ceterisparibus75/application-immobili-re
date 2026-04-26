import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedRouteContext } from "@/lib/api-auth";

export const maxDuration = 60;

function resolveSupabaseTusUrl(rawTusUrl: string, supabaseUrl: string): string | null {
  try {
    const target = new URL(rawTusUrl);
    const supabase = new URL(supabaseUrl);

    if (target.origin !== supabase.origin) return null;
    if (!target.pathname.startsWith("/storage/v1/upload/resumable")) return null;

    return target.toString();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireAuthenticatedRouteContext();
    if (context instanceof NextResponse) return context;

    const tusUrl = req.headers.get("x-tus-url");
    const uploadOffset = req.headers.get("x-upload-offset") ?? "0";
    if (!tusUrl) return NextResponse.json({ error: "x-tus-url manquant" }, { status: 400 });
    if (!/^\d+$/.test(uploadOffset)) {
      return NextResponse.json({ error: "x-upload-offset invalide" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
    }

    const safeTusUrl = resolveSupabaseTusUrl(tusUrl, supabaseUrl);
    if (!safeTusUrl) {
      console.error("[tus-patch] URL TUS rejetée", { tusUrl });
      return NextResponse.json({ error: "URL TUS non autorisée" }, { status: 400 });
    }

    const chunkData = await req.arrayBuffer();

    const patchRes = await fetch(safeTusUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/offset+octet-stream",
        "Content-Length": String(chunkData.byteLength),
        "Upload-Offset": uploadOffset,
        "Tus-Resumable": "1.0.0",
      },
      body: Buffer.from(chunkData),
    });

    if (!patchRes.ok) {
      const msg = await patchRes.text();
      console.error("[tus-patch] Supabase error", patchRes.status, msg);
      return NextResponse.json({ error: `TUS patch ${patchRes.status}: ${msg}` }, { status: 500 });
    }

    const newOffset = patchRes.headers.get("Upload-Offset");
    return NextResponse.json({ offset: newOffset });
  } catch (error) {
    console.error("[tus-patch]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
