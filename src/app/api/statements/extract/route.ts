"use server";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

/* ─── Types de retour ──────────────────────────────────────────────── */

interface ExtractedLine {
  lineType: "CHARGE" | "ENCAISSEMENT" | "DEDUCTION" | "HONORAIRES";
  label: string;
  amount: number;
  nature?: "PROPRIETAIRE" | "RECUPERABLE" | "MIXTE";
}

interface ExtractionResult {
  thirdPartyName: string | null;
  reference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
  dueDate: string | null;
  totalAmount: number | null;
  netAmount: number | null;
  lines: ExtractedLine[];
  confidence: number;
}

/* ─── Helper ───────────────────────────────────────────────────────── */

function mediaType(mime: string): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" {
  if (mime === "application/pdf") return "application/pdf";
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
}

function buildContentBlock(b64: string, mime: string) {
  const mt = mediaType(mime);
  if (mt === "application/pdf") {
    return { type: "document" as const, source: { type: "base64" as const, media_type: mt, data: b64 } };
  }
  return { type: "image" as const, source: { type: "base64" as const, media_type: mt, data: b64 } };
}

/* ─── Prompts par type de relevé ───────────────────────────────────── */

const PROMPTS: Record<string, string> = {
  APPEL_FONDS: `Tu es un expert en gestion immobilière française. Analyse ce document qui est un APPEL DE FONDS d'un syndic de copropriété.

Extrais les informations suivantes en JSON :
- thirdPartyName : nom du syndic
- reference : numéro de référence du document
- periodStart : date de début de période (format YYYY-MM-DD)
- periodEnd : date de fin de période (format YYYY-MM-DD)
- periodLabel : libellé de la période (ex: "T1 2026", "1er trimestre 2026")
- dueDate : date limite de paiement (format YYYY-MM-DD)
- totalAmount : montant total appelé
- netAmount : null (pas applicable pour les appels de fonds)
- lines : tableau de lignes, chacune avec :
  - lineType : toujours "CHARGE"
  - label : libellé du poste de charge (ex: "Chauffage collectif", "Entretien parties communes")
  - amount : montant du poste
  - nature : "RECUPERABLE" si charge récupérable sur le locataire, "PROPRIETAIRE" si charge non récupérable, "MIXTE" si mixte
- confidence : score de confiance entre 0 et 1`,

  DECOMPTE_CHARGES: `Tu es un expert en gestion immobilière française. Analyse ce document qui est un DÉCOMPTE ANNUEL DE CHARGES d'un syndic de copropriété.

Extrais les informations suivantes en JSON :
- thirdPartyName : nom du syndic
- reference : numéro de référence du document
- periodStart : date de début de l'exercice (format YYYY-MM-DD)
- periodEnd : date de fin de l'exercice (format YYYY-MM-DD)
- periodLabel : libellé (ex: "Exercice 2025")
- dueDate : null
- totalAmount : montant total des charges réelles
- netAmount : null
- lines : tableau de lignes, chacune avec :
  - lineType : toujours "CHARGE"
  - label : libellé du poste (ex: "Eau froide", "Ascenseur", "Gardiennage")
  - amount : montant réel du poste
  - nature : "RECUPERABLE" si récupérable, "PROPRIETAIRE" si non récupérable, "MIXTE" si mixte
- confidence : score de confiance entre 0 et 1`,

  DECOMPTE_GESTION: `Tu es un expert en gestion immobilière française. Analyse ce document qui est un DÉCOMPTE DE GESTION LOCATIVE envoyé par une agence immobilière au propriétaire.

Extrais les informations suivantes en JSON :
- thirdPartyName : nom de l'agence de gestion
- reference : numéro de référence du document
- periodStart : date de début de période (format YYYY-MM-DD)
- periodEnd : date de fin de période (format YYYY-MM-DD)
- periodLabel : libellé de la période (ex: "Mars 2026", "T1 2026")
- dueDate : null
- totalAmount : somme de tous les encaissements (loyers + provisions)
- netAmount : montant net reversé au propriétaire
- lines : tableau de lignes, chacune avec :
  - lineType : "ENCAISSEMENT" pour les loyers et provisions encaissés, "HONORAIRES" pour les honoraires de gestion (montant négatif), "DEDUCTION" pour les autres déductions (travaux, assurance, etc., montant négatif)
  - label : libellé (ex: "Loyers encaissés", "Provisions sur charges", "Honoraires de gestion TTC", "Travaux plomberie")
  - amount : montant (positif pour encaissements, négatif pour honoraires et déductions)
- confidence : score de confiance entre 0 et 1

IMPORTANT : les honoraires et déductions doivent avoir un montant NÉGATIF car ce sont des retenues.`,
};

/* ─── Route POST ───────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const societyId = cookieStore.get("active-society-id")?.value;
    if (!societyId) {
      return NextResponse.json({ error: "Aucune société sélectionnée" }, { status: 400 });
    }

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (!type || !PROMPTS[type]) {
      return NextResponse.json({ error: "Type de relevé invalide" }, { status: 400 });
    }

    // Vérifier le type MIME
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Format non supporté. PDF, JPG, PNG ou WebP attendu." }, { status: 400 });
    }

    // Taille max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const b64 = buffer.toString("base64");

    const prompt = PROMPTS[type] + `

Réponds UNIQUEMENT avec le JSON suivant (pas de texte avant ou après) :
{
  "thirdPartyName": "...",
  "reference": "...",
  "periodStart": "YYYY-MM-DD",
  "periodEnd": "YYYY-MM-DD",
  "periodLabel": "...",
  "dueDate": "YYYY-MM-DD ou null",
  "totalAmount": 0,
  "netAmount": 0,
  "lines": [
    { "lineType": "...", "label": "...", "amount": 0, "nature": "..." }
  ],
  "confidence": 0.95
}

Si une information n'est pas trouvée, mets null pour les textes et 0 pour les nombres.`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            buildContentBlock(b64, file.type),
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonrepair(jsonMatch?.[0] ?? "{}")) as Partial<ExtractionResult>;

    const result: ExtractionResult = {
      thirdPartyName: parsed.thirdPartyName ?? null,
      reference: parsed.reference ?? null,
      periodStart: parsed.periodStart ?? null,
      periodEnd: parsed.periodEnd ?? null,
      periodLabel: parsed.periodLabel ?? null,
      dueDate: parsed.dueDate ?? null,
      totalAmount: typeof parsed.totalAmount === "number" ? parsed.totalAmount : null,
      netAmount: typeof parsed.netAmount === "number" ? parsed.netAmount : null,
      lines: Array.isArray(parsed.lines)
        ? parsed.lines.map((l) => ({
            lineType: (["CHARGE", "ENCAISSEMENT", "DEDUCTION", "HONORAIRES"].includes(l.lineType) ? l.lineType : "CHARGE") as ExtractedLine["lineType"],
            label: l.label ?? "",
            amount: typeof l.amount === "number" ? l.amount : 0,
            nature: (["PROPRIETAIRE", "RECUPERABLE", "MIXTE"].includes(l.nature ?? "") ? l.nature : undefined) as ExtractedLine["nature"],
          }))
        : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[POST /api/statements/extract]", error);
    return NextResponse.json({ error: "Erreur lors de l'extraction IA" }, { status: 500 });
  }
}
