import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const tusUrl = req.headers.get("x-tus-url");
    const uploadOffset = req.headers.get("x-upload-offset") ?? "0";
    if (!tusUrl) return NextResponse.json({ error: "x-tus-url manquant" }, { status: 400 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });

    const chunkData = await req.arrayBuffer();

    const patchRes = await fetch(tusUrl, {
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
