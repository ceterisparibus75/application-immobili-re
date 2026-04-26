import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  validateDocumentUploadMetadata,
  verifyDocumentMagicBytes,
} from "@/lib/document-upload-security";

const PORTAL_ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function POST(request: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Non authentifié" } },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const analyze = formData.get("analyze") === "true";

  if (!file) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Aucun fichier fourni" } },
      { status: 400 }
    );
  }

  // Validate file
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Le fichier dépasse 10 Mo" } },
      { status: 400 }
    );
  }

  const metadataValidation = validateDocumentUploadMetadata({
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  });
  if (!metadataValidation.ok || !PORTAL_ALLOWED_MIME_TYPES.has(metadataValidation.mimeType)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Format non autorisé" } },
      { status: 400 }
    );
  }

  const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!verifyDocumentMagicBytes(headerBytes, metadataValidation.mimeType)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Le contenu du fichier ne correspond pas au format déclaré" } },
      { status: 400 }
    );
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Use the specific tenantId from the JWT session — never search across all societies
  const tenant = await prisma.tenant.findFirst({
    where: { id: session.tenantId, email: { equals: session.email, mode: "insensitive" }, isActive: true },
    select: { id: true, societyId: true },
  });

  if (!tenant) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Locataire introuvable" } },
      { status: 404 }
    );
  }

  // Store file (try Supabase if available, otherwise just acknowledge)
  let fileUrl: string | null = null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `portal/${tenant.societyId}/${tenant.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(env.SUPABASE_STORAGE_BUCKET ?? "documents")
        .upload(path, fileBuffer, { contentType: metadataValidation.mimeType });

      if (!uploadError) {
        fileUrl = path;
      }
    }
  } catch {
    // Supabase not configured — file acknowledged but not stored
  }

  // AI analysis (if requested and Anthropic API available)
  let analysis: { category?: string; summary?: string; tags?: string[] } | null = null;

  if (analyze && metadataValidation.mimeType === "application/pdf") {
    try {
      const { analyzeDocument } = await import("@/lib/document-ai");
      const result = await analyzeDocument(fileBuffer, metadataValidation.mimeType, null);
      if (result) {
        analysis = {
          summary: result.summary,
          tags: result.tags,
        };
      }
    } catch {
      // AI not available — skip analysis
    }
  }

  return NextResponse.json({
    data: {
      fileName: file.name,
      fileUrl,
      tenantId: tenant.id,
    },
    analysis,
  });
}
