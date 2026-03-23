import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { jsonrepair } from "jsonrepair";

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ANALYSIS_PROMPT = `Tu es un expert-comptable spécialisé dans la gestion immobilière française. Analyse cette facture ou ce document de charge et extrais les informations suivantes au format JSON strict (sans commentaires, sans markdown) :

{
  "description": "Description concise de la prestation ou dépense (ex: Contrat entretien ascenseur, Assurance PNO, Taxe foncière 2024)",
  "amount": "Montant TTC total en euros (nombre décimal, ex: 1250.00) ou null",
  "date": "Date de la facture ou du document au format YYYY-MM-DD ou null",
  "periodStart": "Début de la période de service/prestation au format YYYY-MM-DD ou null",
  "periodEnd": "Fin de la période de service/prestation au format YYYY-MM-DD ou null",
  "supplierName": "Nom du fournisseur ou prestataire ou null",
  "categoryHint": "Type de charge parmi : ENTRETIEN | ASSURANCE | TAXE | EAU | ELECTRICITE | GAZ | ASCENSEUR | NETTOYAGE | GARDIENNAGE | GESTION | TRAVAUX | AUTRE",
  "invoiceNumber": "Numéro de facture ou null"
}

Règles :
- Renvoie UNIQUEMENT le JSON, sans texte autour, sans bloc markdown.
- Si une information n'est pas trouvée, utilise null.
- Pour amount, retourne le montant TTC (toutes taxes comprises). Si seul le HT est disponible, utilise-le.
- Pour periodStart/periodEnd : cherche une période de service explicite. Sinon, si c'est une facture annuelle, déduis la période (ex: facture du 01/01/2024 → periodStart: 2024-01-01, periodEnd: 2024-12-31). Sinon, laisse null.
- Pour categoryHint : ENTRETIEN = réparations/maintenance, ASSURANCE = primes d'assurance, TAXE = impôts/taxes, EAU = eau/assainissement, ELECTRICITE = électricité, GAZ = gaz/chauffage, ASCENSEUR = contrat ascenseur, NETTOYAGE = ménage/nettoyage, GARDIENNAGE = sécurité/gardien, GESTION = honoraires gestion, TRAVAUX = rénovation/travaux, AUTRE = autre.
- Si le document ne ressemble pas à une facture ou une charge immobilière, renvoie { "error": "Ce document ne semble pas être une facture ou une charge" }.`;

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
      const { storagePath } = await req.json() as { storagePath?: string };
      if (!storagePath) {
        return NextResponse.json({ error: "storagePath requis" }, { status: 400 });
      }

      const { data: blob, error: downloadError } = await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
        .download(storagePath);

      if (downloadError || !blob) {
        console.error("[charges/analyze-pdf] download error", downloadError);
        return NextResponse.json({ error: "Impossible de télécharger le fichier" }, { status: 500 });
      }

      pdfBuffer = Buffer.from(await blob.arrayBuffer());
      tempStoragePath = storagePath;
    } else {
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

    // Lazy require pour capturer tout crash d'initialisation dans le try-catch
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
    let pdfText = "";
    try {
      const pdfData = await pdfParse(pdfBuffer);
      pdfText = pdfData.text.slice(0, 80000);
    } catch (parseErr) {
      console.error("[charges/analyze-pdf] pdf-parse error:", parseErr);
      return NextResponse.json({ error: "Impossible de lire le PDF — fichier protégé ou corrompu" }, { status: 422 });
    }

    if (!pdfText.trim()) {
      return NextResponse.json(
        { error: "Impossible d'extraire le texte du PDF (document scanné sans OCR)" },
        { status: 422 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${ANALYSIS_PROMPT}\n\n---\nCONTENU DU DOCUMENT :\n\n${pdfText}`,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const candidate = jsonMatch ? jsonMatch[0] : rawText;
        parsed = JSON.parse(jsonrepair(candidate));
      } catch {
        return NextResponse.json(
          { error: "Impossible de parser l'analyse du document" },
          { status: 500 }
        );
      }
    }

    if (tempStoragePath) {
      await supabase.storage
        .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
        .remove([tempStoragePath]);
    }

    return NextResponse.json({ data: parsed });
  } catch (error) {
    console.error("[charges/analyze-pdf]", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse du document" }, { status: 500 });
  }
}
