import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const ANALYSIS_PROMPT = `Tu es un expert en diagnostics immobiliers techniques français. Analyse ce document de diagnostic et fournis une synthèse structurée en français comprenant :

1. **Type de diagnostic** : identifie le type (DPE, amiante, plomb, électricité, gaz, termites, etc.)
2. **Résultat / Classement** : note, classe ou conclusion principale (ex: Classe D, Absence d'amiante, Non-conforme)
3. **Points clés** : liste les 3 à 5 points les plus importants du diagnostic
4. **Risques identifiés** : liste les risques ou anomalies détectés (ou "Aucun risque identifié")
5. **Recommandations** : actions recommandées ou travaux à prévoir
6. **Validité** : date de réalisation et date d'expiration si mentionnées

Sois précis, concis et factuel. Si le document n'est pas un diagnostic immobilier, indique-le clairement.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Aucune société active" }, { status: 401 });
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const diagnosticId = formData.get("diagnosticId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
    }

    // Upload vers Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const storagePath = `diagnostics/${societyId}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("[analyze] upload error", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'upload du fichier" }, { status: 500 });
    }

    // URL publique signée (1 an)
    const { data: urlData } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
      .createSignedUrl(storagePath, 24 * 3600); // 24h

    const fileUrl = urlData?.signedUrl ?? null;

    // Analyse Claude
    const pdfBase64 = fileBuffer.toString("base64");
    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          } as Anthropic.DocumentBlockParam,
          { type: "text", text: ANALYSIS_PROMPT },
        ],
      },
    ];

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages,
    });

    const aiAnalysis = message.content[0].type === "text" ? message.content[0].text : "";

    // Mise à jour du diagnostic si un ID est fourni
    if (diagnosticId) {
      await prisma.diagnostic.update({
        where: { id: diagnosticId },
        data: {
          fileUrl,
          fileStoragePath: storagePath,
          aiAnalysis,
          aiAnalyzedAt: new Date(),
        } as Record<string, unknown>,
      });
    }

    return NextResponse.json({ fileUrl, fileStoragePath: storagePath, aiAnalysis });
  } catch (error) {
    console.error("[analyze]", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse" }, { status: 500 });
  }
}
