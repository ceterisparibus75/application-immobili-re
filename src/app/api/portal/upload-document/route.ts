import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

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

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExts = ["pdf", "jpg", "jpeg", "png"];
  if (!allowedExts.includes(ext)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Format non autorisé" } },
      { status: 400 }
    );
  }

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path = `portal/${tenant.societyId}/${tenant.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, buffer, { contentType: file.type });

      if (!uploadError) {
        fileUrl = path;
      }
    }
  } catch {
    // Supabase not configured — file acknowledged but not stored
  }

  // AI analysis (if requested and Anthropic API available)
  let analysis: { category?: string; summary?: string; tags?: string[] } | null = null;

  if (analyze && ext === "pdf") {
    try {
      const { analyzeDocument } = await import("@/lib/document-ai");
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const result = await analyzeDocument(buffer, file.type, null);
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
