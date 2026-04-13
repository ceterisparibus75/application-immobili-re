import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { jsonrepair } from "jsonrepair";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { requireSocietyAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

const EXTRACTION_PROMPT = `Tu es un expert en gestion locative et droit immobilier français. Analyse cet avenant déjà signé et extrais uniquement les informations nécessaires pour l'enregistrer dans l'application.

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas d'explication).

Structure exacte :
{
  "amendmentType": "RENOUVELLEMENT|AVENANT_LOYER|AVENANT_DUREE|AVENANT_DIVERS|RESILIATION",
  "effectiveDate": "YYYY-MM-DD",
  "description": "Résumé court et exploitable de l'avenant",
  "newRentHT": 0.0,
  "newEndDate": "YYYY-MM-DD",
  "otherChangesSummary": "Autres changements utiles ou null"
}

Règles :
- amendmentType = RENOUVELLEMENT si le document prolonge le bail ou le renouvelle explicitement
- amendmentType = AVENANT_LOYER si la modification principale concerne le loyer
- amendmentType = AVENANT_DUREE si la modification principale concerne la durée ou l'échéance
- amendmentType = RESILIATION si le document acte une fin anticipée ou une résiliation
- amendmentType = AVENANT_DIVERS sinon
- effectiveDate doit être la vraie date d'effet du changement, pas la date de signature si elle est différente
- newRentHT doit être mensuel HT si un nouveau loyer est explicitement identifiable, sinon null
- newEndDate doit être renseignée uniquement si l'échéance du bail change, sinon null
- description doit être courte, concrète, directement exploitable dans une timeline produit
- otherChangesSummary = null si rien d'important à signaler au-delà de la description`;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
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

    if (!env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "La clé API Anthropic n'est pas configurée. Contactez l'administrateur." },
        { status: 503 }
      );
    }

    const { storagePath, leaseId } = (await req.json()) as {
      storagePath?: string;
      leaseId?: string;
    };

    if (!storagePath || !leaseId) {
      return NextResponse.json({ error: "storagePath ou leaseId manquant" }, { status: 400 });
    }

    if (!storagePath.startsWith("temp/") && !storagePath.includes(societyId)) {
      return NextResponse.json({ error: "Accès non autorisé au fichier" }, { status: 403 });
    }

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId },
      select: {
        id: true,
        leaseType: true,
        currentRentHT: true,
        endDate: true,
        startDate: true,
        tenant: {
          select: {
            entityType: true,
            companyName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!lease) {
      return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });
    }

    const supabase = getSupabase();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("[lease-amendments/analyze] download error", downloadError);
      return NextResponse.json({ error: "Impossible de récupérer le fichier" }, { status: 500 });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    const pdfBase64 = fileBuffer.toString("base64");

    const tenantName =
      lease.tenant.entityType === "PERSONNE_MORALE"
        ? lease.tenant.companyName ?? "Locataire non renseigné"
        : [lease.tenant.firstName, lease.tenant.lastName].filter(Boolean).join(" ") || "Locataire non renseigné";

    const contextualPrompt = `${EXTRACTION_PROMPT}

Contexte bail actuel :
- type de bail : ${lease.leaseType}
- locataire : ${tenantName}
- loyer HT actuel : ${lease.currentRentHT}
- date de début actuelle : ${lease.startDate.toISOString().slice(0, 10)}
- date de fin actuelle : ${lease.endDate.toISOString().slice(0, 10)}

Si l'avenant confirme les données actuelles sans changement chiffré, conserve newRentHT ou newEndDate à null.`;

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            } as Anthropic.DocumentBlockParam,
            { type: "text", text: contextualPrompt },
          ],
        },
      ],
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Impossible d'extraire les informations de l'avenant signé." },
        { status: 422 }
      );
    }

    void supabase.storage.from(bucket).remove([storagePath]).catch(() => null);

    const extracted = JSON.parse(jsonrepair(jsonMatch[0])) as {
      amendmentType?: string | null;
      effectiveDate?: string | null;
      description?: string | null;
      newRentHT?: number | null;
      newEndDate?: string | null;
      otherChangesSummary?: string | null;
    };

    return NextResponse.json(extracted);
  } catch (error) {
    console.error("[lease-amendments/analyze]", error);
    const message =
      error instanceof Error ? error.message : "Erreur lors de l'analyse de l'avenant signé";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
