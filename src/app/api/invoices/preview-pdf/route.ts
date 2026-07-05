import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf, type InvoicePdfData } from "@/lib/invoice-pdf";
import { env } from "@/lib/env";
import { Redis } from "@upstash/redis";
import React from "react";
import crypto from "crypto";

/**
 * Aperçu PDF d'une facture non-persistée (batch generation, correction manuelle).
 *
 * Store partagé POST/GET :
 *   - Priorité : Upstash Redis (production, multi-instance safe)
 *   - Fallback : globalThis.__invoicePreviewCache (dev / instance unique)
 *
 * Pourquoi pas juste globalThis ? Sur Vercel, chaque invocation serverless
 * peut atterrir sur une instance différente ; un POST puis un GET immédiat
 * peuvent se retrouver sur deux lambdas et le token disparaît → 404.
 */

type CacheEntry = { data: InvoicePdfData; userId: string };
const KEY_PREFIX = "invoice-preview:";
const TTL_SECONDS = 5 * 60;

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

declare global {
  // eslint-disable-next-line no-var
  var __invoicePreviewCache:
    | Map<string, { entry: CacheEntry; expiresAt: number }>
    | undefined;
}
const memoryCache =
  globalThis.__invoicePreviewCache ??
  new Map<string, { entry: CacheEntry; expiresAt: number }>();
globalThis.__invoicePreviewCache = memoryCache;

async function storeEntry(token: string, entry: CacheEntry) {
  const redis = getRedis();
  if (redis) {
    await redis.set(KEY_PREFIX + token, JSON.stringify(entry), { ex: TTL_SECONDS });
    return;
  }
  memoryCache.set(token, { entry, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

async function readEntry(token: string): Promise<CacheEntry | null> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get<string | CacheEntry>(KEY_PREFIX + token);
    if (!raw) return null;
    // Upstash désérialise automatiquement les strings JSON → on gère les 2 cas
    return typeof raw === "string" ? (JSON.parse(raw) as CacheEntry) : raw;
  }
  const mem = memoryCache.get(token);
  if (!mem) return null;
  if (mem.expiresAt < Date.now()) {
    memoryCache.delete(token);
    return null;
  }
  return mem.entry;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: InvoicePdfData;
  try {
    body = (await req.json()) as InvoicePdfData;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const token = crypto.randomUUID();
  await storeEntry(token, { data: body, userId: session.user.id });
  return NextResponse.json({ token });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = req.nextUrl.searchParams.get("token");
  if (!token)
    return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const entry = await readEntry(token);
  if (!entry)
    return NextResponse.json({ error: "expired_or_missing" }, { status: 404 });
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
