import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedRouteContext } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";
import { requireSocietyAccess } from "@/lib/permissions";
import { env } from "@/lib/env";
import * as nodePath from "path";

/**
 * Sanitize a storage path to prevent path traversal attacks.
 * Decodes URL-encoded characters, resolves traversals, and validates the result.
 */
function sanitizePath(raw: string): string | null {
  // Decode any URL-encoded sequences (handles %2f, %2e, double-encoding, etc.)
  let decoded = raw;
  try {
    decoded = decodeURIComponent(decoded);
    // Double-decode to catch %252f → %2f → /
    decoded = decodeURIComponent(decoded);
  } catch {
    // If decoding fails, use the raw value
  }

  // Remove null bytes
  decoded = decoded.replace(/\0/g, "");

  // Resolve to prevent directory traversal
  const resolved = nodePath.posix.normalize(decoded).replace(/^\/+/, "");

  // Reject if still contains traversal patterns or absolute paths
  if (resolved.startsWith("..") || resolved.includes("/../") || resolved.startsWith("/")) {
    return null;
  }

  return resolved;
}

async function hasAccessToStoragePath(userId: string, cleanPath: string): Promise<boolean> {
  const pathSegments = cleanPath.split("/");
  const rootFolder = pathSegments[0];
  const secondSegment = pathSegments[1];

  // Refuser tout chemin de moins de 2 segments : on ne peut pas autoriser
  // un objet à la racine du bucket sans contexte de propriété.
  if (!rootFolder || !secondSegment) {
    return false;
  }

  // Whitelist explicite des préfixes connus. Tout préfixe inconnu est
  // refusé (closed by default) — empêche qu'un objet hors conventions
  // (`secret/...`) soit téléchargeable.
  const SOCIETY_ID_FOLDERS = new Set([
    "documents",
    "logos",
    "invoices",
    "quittances",
    "leases",
    "diagnostics",
    "portal",
  ]);

  if (SOCIETY_ID_FOLDERS.has(rootFolder)) {
    await requireSocietyAccess(userId, secondSegment);
    return true;
  }

  // Temp files : temp/<userId>/... (propre à l'utilisateur) ou temp/<societyId>/...
  if (rootFolder === "temp") {
    if (secondSegment === userId) {
      return true;
    }
    await requireSocietyAccess(userId, secondSegment);
    return true;
  }

  // Préfixe inconnu → refuser explicitement.
  return false;
}

export async function GET(req: NextRequest) {
  const context = await requireAuthenticatedRouteContext();
  if (context instanceof NextResponse) return context;

  const path = req.nextUrl.searchParams.get("path");
  if (!path || path.trim() === "") return new NextResponse(null, { status: 400 });
  const forceDownload = req.nextUrl.searchParams.get("dl") === "1";

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[storage/view] Variables Supabase manquantes");
    return new NextResponse(null, { status: 503 });
  }

  const cleanPath = sanitizePath(path);
  if (!cleanPath) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const allowed = await hasAccessToStoragePath(context.userId, cleanPath);
    if (!allowed) {
      return new NextResponse(null, { status: 403 });
    }
  } catch {
    return new NextResponse(null, { status: 403 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";
  const ext = cleanPath.split(".").pop()?.toLowerCase() ?? "";
  const forceAttachmentExts = new Set(["svg", "html", "htm", "xml", "xhtml"]);
  const mustForceDownload = forceDownload || forceAttachmentExts.has(ext);

  // Téléchargement direct — contourne les problèmes de CORS et de policies sur les URLs signées
  const { data: blob, error } = await supabase.storage.from(bucket).download(cleanPath);

  if (error || !blob) {
    console.error("[storage/view] download error:", error?.message, "path:", cleanPath, "bucket:", bucket);
    // Fallback : essayer avec une URL signée
    const { data: signed, error: signedErr } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 3600);
    if (signedErr || !signed?.signedUrl) {
      console.error("[storage/view] signedUrl error:", signedErr?.message);
      return new NextResponse(null, { status: 404 });
    }
    if (mustForceDownload) {
      // Cannot redirect for dl=1 (Content-Disposition not forwarded) — proxy through signed URL
      const proxied = await fetch(signed.signedUrl).catch(() => null);
      if (!proxied?.ok) return new NextResponse(null, { status: 404 });
      const ab2 = await proxied.arrayBuffer();
      const mimeMap2: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf" };
      const ct2 = forceAttachmentExts.has(ext) ? "application/octet-stream" : (mimeMap2[ext] ?? proxied.headers.get("content-type") ?? "application/octet-stream");
      const fn2 = cleanPath.split("/").pop() ?? "document";
      return new NextResponse(ab2, { headers: {
        "Content-Type": ct2,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fn2)}"`,
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(ab2.byteLength),
        "X-Content-Type-Options": "nosniff",
      }});
    }
    const response = NextResponse.redirect(signed.signedUrl);
    response.headers.set("Cache-Control", "private, max-age=3600");
    return response;
  }

  const ab = await blob.arrayBuffer();
  const mimeMap: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp",
    pdf: "application/pdf",
  };
  const contentType = forceAttachmentExts.has(ext)
    ? "application/octet-stream"
    : (mimeMap[ext] ?? blob.type ?? "application/octet-stream");

  const fileName = cleanPath.split("/").pop() ?? "document";
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "Content-Length": String(ab.byteLength),
    "X-Content-Type-Options": "nosniff",
  };
  if (mustForceDownload) {
    headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(fileName)}"`;
  }

  return new NextResponse(ab, { headers });
}
