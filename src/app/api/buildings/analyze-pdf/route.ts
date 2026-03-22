import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { jsonrepair } from "jsonrepair";
import * as pdfParse from "pdf-parse";

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    let pdfBuffer: Buffer;
    let tempStoragePath: string | null = null;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      // Fichier déjà uploadé dans Supabase Storage (flux pour grands fichiers)
      const { storagePath } = await req.json() as { storagePath?: string };
      if (!storagePath) {
        return NextResponse.json({ error: "storagePath requis" }, { status: 400 });
      }

      const { data: blob, error: downloadError } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
        .download(storagePath);

      if (downloadError || !blob) {
        console.error("[analyze-pdf] download error", downloadError);
        return NextResponse.json({ error: "Impossible de télécharger le fichier" }, { status: 500 });
      }

      pdfBuffer = Buffer.from(await blob.arrayBuffer());
      tempStoragePath = storagePath;
    } else {
      // Upload direct (petits fichiers)
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

      pdfBuffer = Buffer.from(await file.arrayBuffer());
    }

    // Extraction du texte du PDF (beaucoup plus rapide que l'envoi base64)
    const pdfData = await pdfParse(pdfBuffer);
    // Limiter à 80 000 caractères pour rester dans les limites de contexte
    const pdfText = pdfData.text.slice(0, 80000);

    if (!pdfText.trim()) {
      return NextResponse.json({ error: "Impossible d'extraire le texte du PDF (document peut-être scanné)" }, { status: 422 });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${ANALYSIS_PROMPT}\n\n---\nCONTENU DU DOCUMENT :\n\n${pdfText}`,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse le JSON retourné par Claude
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      try {
        // jsonrepair corrige les caractères non échappés, virgules manquantes, etc.
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const candidate = jsonMatch ? jsonMatch[0] : rawText;
        parsed = JSON.parse(jsonrepair(candidate));
      } catch {
        return NextResponse.json({ error: "Impossible de parser l'analyse du document" }, { status: 500 });
      }
    }

    // Recherche de doublons dans la société
    const duplicates: {
      buildings: Array<{ id: string; name: string; addressLine1: string; city: string; matchReason: string }>;
      lots: Array<{ id: string; number: string; buildingName: string; matchReason: string }>;
    } = { buildings: [], lots: [] };

    // 1. Chercher les immeubles existants similaires (par adresse ou nom)
    if (parsed.addressLine1 || parsed.name) {
      const existingBuildings = await prisma.building.findMany({
        where: {
          societyId,
          OR: [
            ...(parsed.addressLine1 ? [{
              addressLine1: { contains: String(parsed.addressLine1).split(" ").slice(-2).join(" "), mode: "insensitive" as const },
              city: parsed.city ? { equals: String(parsed.city), mode: "insensitive" as const } : undefined,
            }] : []),
            ...(parsed.name ? [{
              name: { contains: String(parsed.name), mode: "insensitive" as const },
            }] : []),
            ...(parsed.postalCode ? [{
              postalCode: String(parsed.postalCode),
              city: parsed.city ? { equals: String(parsed.city), mode: "insensitive" as const } : undefined,
            }] : []),
          ],
        },
        select: { id: true, name: true, addressLine1: true, city: true, postalCode: true },
        take: 5,
      });

      for (const b of existingBuildings) {
        const reasons: string[] = [];
        if (parsed.name && b.name.toLowerCase().includes(String(parsed.name).toLowerCase())) reasons.push("nom similaire");
        if (parsed.addressLine1 && b.addressLine1.toLowerCase().includes(String(parsed.addressLine1).toLowerCase().split(" ").slice(-2).join(" "))) reasons.push("même adresse");
        if (parsed.postalCode && b.postalCode === String(parsed.postalCode)) reasons.push("même code postal");
        duplicates.buildings.push({
          id: b.id,
          name: b.name,
          addressLine1: b.addressLine1,
          city: b.city,
          matchReason: reasons.join(", ") || "correspondance possible",
        });
      }
    }

    // 2. Chercher les lots existants similaires
    const extractedLots = parsed.lots as Array<{ number?: string }> | undefined;
    if (extractedLots?.length) {
      const lotNumbers = extractedLots.map((l) => l.number).filter(Boolean) as string[];
      if (lotNumbers.length > 0) {
        const existingLots = await prisma.lot.findMany({
          where: {
            building: { societyId },
            number: { in: lotNumbers },
          },
          select: {
            id: true,
            number: true,
            building: { select: { name: true } },
          },
          take: 20,
        });

        for (const l of existingLots) {
          duplicates.lots.push({
            id: l.id,
            number: l.number,
            buildingName: l.building.name,
            matchReason: `lot n°${l.number} existe dans ${l.building.name}`,
          });
        }
      }
    }

    // Supprimer le fichier temporaire Supabase après analyse
    if (tempStoragePath) {
      await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
        .remove([tempStoragePath]);
    }

    return NextResponse.json({ data: parsed, duplicates });
  } catch (error) {
    console.error("[analyze-pdf]", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse du document" }, { status: 500 });
  }
}
