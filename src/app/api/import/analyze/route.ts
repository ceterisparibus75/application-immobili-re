import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess } from "@/lib/permissions";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const maxDuration = 120;

const EXTRACTION_PROMPT = `Tu es un expert en droit immobilier français. Analyse ce bail et extrais les informations structurées.

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
    "lotType": "LOCAL_COMMERCIAL|BUREAUX|LOCAL_ACTIVITE|APPARTEMENT|ENTREPOT|PARKING|CAVE|TERRASSE|RESERVE",
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
    "baseIndexValue": 0.0,
    "baseIndexQuarter": "T1 2021|T2 2021|T3 2021|T4 2021|null",
    "revisionFrequency": 12,
    "rentFreeMonths": 0,
    "entryFee": 0.0,
    "destination": "HABITATION|BUREAU|COMMERCE|ACTIVITE|ENTREPOT|INDUSTRIEL|PROFESSIONNEL|MIXTE|PARKING|TERRAIN|AGRICOLE|HOTELLERIE|EQUIPEMENT|AUTRE|null",
    "tenantWorksClauses": "Clauses travaux preneur ou null"
  }
}

Règles :
- destination : usage prévu des locaux tel que mentionné dans le bail. HABITATION pour logement, BUREAU pour bureaux/tertiaire, COMMERCE pour boutique/restaurant, ACTIVITE pour atelier/artisanat, ENTREPOT pour stockage/logistique, INDUSTRIEL pour usine, PROFESSIONNEL pour cabinet libéral, MIXTE pour habitation+professionnel, PARKING pour garage/box, TERRAIN pour terrain nu, AGRICOLE pour exploitation agricole, HOTELLERIE pour hôtel/tourisme, EQUIPEMENT pour salle/crèche/clinique, AUTRE sinon. Si non précisé, déduire du type de bail.
- buildingType : COMMERCE pour local commercial/boutique, BUREAU pour bureaux, ENTREPOT pour entrepôt/stockage, MIXTE sinon
- leaseType : HABITATION pour bail vide loi 1989, MEUBLE pour bail meublé ALUR, ETUDIANT pour bail étudiant meublé 9 mois, MOBILITE pour bail mobilité ELAN, COLOCATION pour bail colocation, SAISONNIER pour location saisonnière, LOGEMENT_FONCTION pour logement de fonction, ANAH pour convention ANAH, CIVIL pour bail Code civil (résidence secondaire), GLISSANT pour bail glissant (insertion sociale), SOUS_LOCATION pour sous-location, COMMERCIAL_369 pour bail 3-6-9 (art. L145), DEROGATOIRE pour bail < 3 ans, PRECAIRE pour convention précaire, BAIL_PROFESSIONNEL pour bail professionnel (professions libérales), MIXTE pour bail mixte habitation+professionnel, EMPHYTEOTIQUE pour bail emphytéotique (18-99 ans), CONSTRUCTION pour bail à construction, REHABILITATION pour bail à réhabilitation, BRS pour bail réel solidaire (OFS), RURAL pour bail rural/agricole
- durationMonths : 36 pour habitation (3 ans), 12 pour meublé (1 an), 9 pour étudiant, 10 pour mobilité, 108 pour bail 3-6-9 (9 ans), 72 pour professionnel (6 ans), 36 pour dérogatoire (3 ans max), 1188 pour emphytéotique (99 ans)
- indexType : IRL pour habitation/meublé, ILC pour commercial/rural, ILAT pour professionnel/tertiaire, ICC rarement utilisé. Cherche la mention explicite dans le bail (ex: "indice de référence des loyers" = IRL, "indice des loyers commerciaux" = ILC)
- baseIndexValue : valeur numérique de l'indice de référence mentionnée dans le bail (ex: "indice de base 130.69", "IRL du T1 2021 = 130.69"). Si non trouvée, null
- baseIndexQuarter : trimestre de référence au format "T1 YYYY" (ex: "T1 2021", "T4 2020"). Cherche "trimestre de référence", "indice du T...", "publié au..."
- revisionFrequency : 12 par défaut (annuel). Si le bail mentionne une révision triennale, mettre 36
- Les montants sont en euros HT/an si loyer annuel, /mois si mensuel — converti toujours en euros HT/MOIS
- Si une info est absente, mets null pour les champs optionnels
- startDate au format ISO YYYY-MM-DD`;

// Body envoyé en streaming (application/octet-stream) pour contourner
// la limite Vercel de 4.5 Mo sur les corps de requête parsés.
// Le nom du fichier est dans le header x-filename.

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

    if (!req.body) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    // Lire le body en streaming et le collecter en buffer
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
      if (totalSize > 20 * 1024 * 1024) {
        return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 400 });
      }
    }
    const fileBuffer = Buffer.concat(chunks);
    const pdfBase64 = fileBuffer.toString("base64");

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

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
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

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
    const msg = error instanceof Error ? error.message : "Erreur lors de l'analyse du document";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
