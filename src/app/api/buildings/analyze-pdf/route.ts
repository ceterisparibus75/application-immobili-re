import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ANALYSIS_PROMPT = `Tu es un expert en immobilier et en actes notariés français. Analyse cet acte d'acquisition immobilière et extrais les informations suivantes au format JSON strict (sans commentaires, sans markdown) :

{
  "name": "Nom ou désignation du bien (ex: Immeuble Le Châtelet)",
  "addressLine1": "Numéro et nom de rue",
  "addressLine2": "Complément d'adresse ou null",
  "city": "Ville",
  "postalCode": "Code postal (5 chiffres)",
  "buildingType": "BUREAU | COMMERCE | MIXTE | ENTREPOT (déduis le type selon la description du bien)",
  "yearBuilt": "Année de construction (nombre entier) ou null",
  "totalArea": "Surface totale en m² (nombre) ou null",
  "acquisitionPrice": "Prix d'acquisition en euros (nombre, hors frais de notaire) ou null",
  "acquisitionDate": "Date de l'acte au format YYYY-MM-DD ou null",
  "description": "Résumé concis du bien (désignation, particularités, nombre de lots/niveaux, etc.)",
  "lots": [
    {
      "number": "Numéro ou identifiant du lot",
      "lotType": "LOCAL_COMMERCIAL | BUREAUX | LOCAL_ACTIVITE | APPARTEMENT | RESERVE | PARKING | CAVE | TERRASSE | ENTREPOT",
      "area": "Surface en m² (nombre)",
      "floor": "Étage ou null",
      "description": "Description courte ou null"
    }
  ]
}

Règles :
- Renvoie UNIQUEMENT le JSON, sans texte autour, sans bloc markdown.
- Si une information n'est pas trouvée dans le document, utilise null.
- Pour buildingType, déduis selon le contexte : bureaux → BUREAU, commerce → COMMERCE, mixte → MIXTE, entrepôt/activité → ENTREPOT.
- Pour les lots, extrais tous les lots/unités mentionnés dans l'acte. Si aucun lot n'est détaillé, renvoie un tableau vide [].
- Les montants doivent être des nombres sans symbole € ni espace.
- Si le document n'est pas un acte d'acquisition, renvoie { "error": "Ce document ne semble pas être un acte d'acquisition immobilière" }.`;

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 400 });
    }

    // Analyse Claude
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const pdfBase64 = fileBuffer.toString("base64");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
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
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse le JSON retourné par Claude
    try {
      const parsed = JSON.parse(rawText);
      return NextResponse.json({ data: parsed });
    } catch {
      // Si le JSON est mal formé, tenter d'extraire le JSON du texte
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ data: parsed });
      }
      return NextResponse.json({ error: "Impossible de parser l'analyse du document", raw: rawText }, { status: 500 });
    }
  } catch (error) {
    console.error("[analyze-pdf]", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse du document" }, { status: 500 });
  }
}
