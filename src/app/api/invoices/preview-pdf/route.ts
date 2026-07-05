import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf, type InvoicePdfData } from "@/lib/invoice-pdf";
import React from "react";
import crypto from "crypto";

/**
 * Aperçu PDF d'une facture non-persistée (batch generation, correction manuelle).
 *
 * On sert le PDF depuis une URL same-origin (iframe-friendly) plutôt qu'en
 * blob:// côté client — Chrome bloque le rendu de blob PDF en iframe avec la
 * CSP par défaut, et @react-pdf/renderer côté client nécessite WebAssembly
 * qui pose problème avec strict-dynamic. Le rendu ici utilise exactement le
 * même composant InvoicePdf que la facture finale, donc l'aperçu est 100 %
 * fidèle.
 *
 * Flux : POST { pdfData } → { token } → GET ?token=... → application/pdf
 * Le token est éphémère (5 min) et scopé à l'utilisateur qui l'a créé.
 */

type CacheEntry = { data: InvoicePdfData; userId: string; expiresAt: number };

// Utilise globalThis pour partager le cache entre invocations POST/GET sur la
// même instance serverless. Sur Vercel, cela fonctionne dans la fenêtre chaude
// (les 2 requêtes s'enchaînent immédiatement côté client, donc cohabitent sur
// la même Lambda). Fallback : le token n'est pas trouvé → 404, le client relance.
declare global {
  // eslint-disable-next-line no-var
  var __invoicePreviewCache: Map<string, CacheEntry> | undefined;
}
const cache: Map<string, CacheEntry> =
  globalThis.__invoicePreviewCache ?? new Map<string, CacheEntry>();
globalThis.__invoicePreviewCache = cache;

const TTL_MS = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt < now) cache.delete(k);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  cleanup();
  let body: InvoicePdfData;
  try {
    body = (await req.json()) as InvoicePdfData;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const token = crypto.randomUUID();
  cache.set(token, { data: body, userId: session.user.id, expiresAt: Date.now() + TTL_MS });
  return NextResponse.json({ token });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("token");
  if (!token)
    return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const entry = cache.get(token);
  if (!entry || entry.expiresAt < Date.now())
    return NextResponse.json({ error: "expired" }, { status: 404 });
  if (entry.userId !== session.user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(React.createElement(InvoicePdf, { data: entry.data }) as any);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[preview-pdf]", error);
    return NextResponse.json(
      { error: "render_failed", message: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
