import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const maxDuration = 60;

const EXTRACTION_PROMPT = `Tu es un expert en droit immobilier commercial français. Analyse ce bail et extrais les informations structurées.

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas d'explication).

Structure exacte :
{
  "immeuble": {
    "name": "Nom ou adresse courte de l'immeuble",
    "addressLine1": "Numéro et rue",
    "city": "Ville",
    "postalCode": "Code postal 5 chiffres",
    "buildingType": "BUREAU|COMMERCE|MIXTE|ENTREPOT"
  },
  "lot": {
    "number": "Numéro ou référence du lot (ex: A1, 12, RDC-G)",
    "lotType": "LOCAL_COMMERCIAL|BUREAUX|LOCAL_ACTIVITE|BUREAU|ENTREPOT|PARKING|CAVE|TERRASSE|RESERVE",
    "area": 0.0,
    "floor": "RDC|1er|2ème...",
    "position": "Description de la position (ex: aile gauche, bâtiment B)"
  },
  "locataire": {
    "entityType": "PERSONNE_MORALE|PERSONNE_PHYSIQUE",
    "companyName": "Raison sociale si personne morale, sinon null",
    "companyLegalForm": "SAS|SARL|SA|EURL|SNC|EI|AUTRE ou null",
    "siret": "14 chiffres ou null",
    "legalRepName": "Nom prénom du représentant légal ou null",
    "legalRepTitle": "Gérant|Président|DG... ou null",
    "legalRepEmail": "Email représentant ou null",
    "legalRepPhone": "Téléphone représentant ou null",
    "firstName": "Prénom si personne physique, sinon null",
    "lastName": "Nom si personne physique, sinon null",
    "email": "Email principal (si absent utilise 'a-renseigner@exemple.fr')",
    "phone": "Téléphone ou null",
    "mobile": "Mobile ou null"
  },
  "bail": {
    "leaseType": "HABITATION|MEUBLE|ETUDIANT|MOBILITE|COLOCATION|SAISONNIER|LOGEMENT_FONCTION|ANAH|CIVIL|GLISSANT|SOUS_LOCATION|COMMERCIAL_369|DEROGATOIRE|PRECAIRE|BAIL_PROFESSIONNEL|MIXTE|EMPHYTEOTIQUE|CONSTRUCTION|REHABILITATION|BRS|RURAL",
    "startDate": "YYYY-MM-DD",
    "durationMonths": 108,
    "baseRentHT": 0.0,
    "depositAmount": 0.0,
    "paymentFrequency": "MENSUEL|TRIMESTRIEL",
    "vatApplicable": true,
    "vatRate": 20.0,
    "indexType": "IRL|ILC|ILAT|ICC|null",
    "rentFreeMonths": 0,
    "entryFee": 0.0,
    "tenantWorksClauses": "Clauses travaux preneur ou null"
  }
}

Règles :
- buildingType : COMMERCE pour local commercial/boutique, BUREAU pour bureaux, ENTREPOT pour entrepôt/stockage, MIXTE sinon
- leaseType : HABITATION pour bail vide loi 1989, MEUBLE pour bail meublé ALUR, ETUDIANT pour bail étudiant meublé 9 mois, MOBILITE pour bail mobilité ELAN, COLOCATION pour bail colocation, SAISONNIER pour location saisonnière, LOGEMENT_FONCTION pour logement de fonction, ANAH pour convention ANAH, CIVIL pour bail Code civil (résidence secondaire), GLISSANT pour bail glissant (insertion sociale), SOUS_LOCATION pour sous-location, COMMERCIAL_369 pour bail 3-6-9 (art. L145), DEROGATOIRE pour bail < 3 ans, PRECAIRE pour convention précaire, BAIL_PROFESSIONNEL pour bail professionnel (professions libérales), MIXTE pour bail mixte habitation+professionnel, EMPHYTEOTIQUE pour bail emphytéotique (18-99 ans), CONSTRUCTION pour bail à construction, REHABILITATION pour bail à réhabilitation, BRS pour bail réel solidaire (OFS), RURAL pour bail rural/agricole
- durationMonths : 36 pour habitation (3 ans), 12 pour meublé (1 an), 9 pour étudiant, 10 pour mobilité, 108 pour bail 3-6-9 (9 ans), 72 pour professionnel (6 ans), 36 pour dérogatoire (3 ans max), 1188 pour emphytéotique (99 ans)
- Les montants sont en euros HT/an si loyer annuel, /mois si mensuel — converti toujours en euros HT/MOIS
- Si une info est absente, mets null pour les champs optionnels
- startDate au format ISO YYYY-MM-DD`;

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
        { error: "La clé API Anthropic n’est pas configurée. Contactez l’administrateur." },
        { status: 503 }
      );
    }

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 15 Mo)" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const pdfBase64 = fileBuffer.toString("base64");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            } as Anthropic.DocumentBlockParam,
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response (handles potential markdown wrapping)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Impossible d'extraire les données du document. Vérifiez qu'il s'agit bien d'un bail." },
        { status: 422 }
      );
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json(extracted);
  } catch (error) {
    console.error("[import/analyze]", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse du document" }, { status: 500 });
  }
}
