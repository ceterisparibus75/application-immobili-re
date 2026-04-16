import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { requireSocietyAccess } from "@/lib/permissions";
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path || path.trim() === "") return new NextResponse(null, { status: 400 });
  const forceDownload = req.nextUrl.searchParams.get("dl") === "1";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[storage/view] Variables Supabase manquantes");
    return new NextResponse(null, { status: 503 });
  }

  const cleanPath = sanitizePath(path);
  if (!cleanPath) {
    return new NextResponse(null, { status: 400 });
  }

  // Verify the user has access to the society owning this file.
  // Only folders that store files under <folder>/<societyId>/... are checked.
  const SOCIETY_ID_FOLDERS = new Set(["documents", "logos", "invoices", "leases", "diagnostics", "portal"]);
  const pathSegments = cleanPath.split("/");

  if (pathSegments.length >= 2 && SOCIETY_ID_FOLDERS.has(pathSegments[0])) {
    const pathSocietyId = pathSegments[1];
    try {
      await requireSocietyAccess(session.user.id, pathSocietyId);
    } catch {
      return new NextResponse(null, { status: 403 });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

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
    const response = NextResponse.redirect(signed.signedUrl);
    response.headers.set("Cache-Control", "private, max-age=3600");
    return response;
  }

  const ab = await blob.arrayBuffer();
  const ext = cleanPath.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  const contentType = mimeMap[ext] ?? blob.type ?? "application/octet-stream";

  const fileName = cleanPath.split("/").pop() ?? "document";
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "Content-Length": String(ab.byteLength),
  };
  if (forceDownload) {
    headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(fileName)}"`;
  }

  return new NextResponse(ab, { headers });
}
