import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";

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

  const supabase = createClient(supabaseUrl, supabaseKey);
  const cleanPath = path.replace(/\.\.\//g, "").replace(/^\//, "");

  // P0 security: verify the requested path belongs to the user's active society
  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return new NextResponse(null, { status: 403 });

  try {
    await requireSocietyAccess(session.user.id, societyId, "LECTURE");
  } catch (error) {
    if (error instanceof ForbiddenError) return new NextResponse(null, { status: 403 });
    return new NextResponse(null, { status: 403 });
  }

  // Ensure the path is scoped to the user's society (documents/{societyId}/... or logos/{societyId}/...)
  const pathSegments = cleanPath.split("/");
  const societyPathIndex = pathSegments.indexOf(societyId);
  if (societyPathIndex < 0) {
    console.error("[storage/view] Rejected cross-tenant access:", cleanPath, "society:", societyId);
    return new NextResponse(null, { status: 403 });
  }
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
