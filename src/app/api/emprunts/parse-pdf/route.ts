import { NextRequest, NextResponse } from "next/server";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const EXTRACTION_PROMPT = `Tu es un expert comptable spécialisé dans l'analyse de tableaux d'amortissement de prêts immobiliers français.

Analyse ce document PDF et extrais les informations suivantes au format JSON strict.

REGLE ABSOLUE N1 — PRECISION EXACTE, AUCUN RECALCUL
Copie les montants EXACTEMENT tels qu'ils apparaissent dans le PDF, chiffre par chiffre.
- NE JAMAIS arrondir, tronquer ou recalculer un montant
- NE JAMAIS calculer un champ a partir d'un autre (ex: ne pas calculer balance = balance_precedent - principal)
- Si une valeur dans le PDF est "4 808,45" => ecrire 4808.45 (pas 4808.4 ni 4808.5)
- Si le PDF affiche "249 280,13" => ecrire 249280.13 exactement
- La valeur extraite doit etre IDENTIQUE au centieme pres a la valeur imprimee dans le tableau
- En cas de doute entre deux lectures possibles, lis plus attentivement — ne devine pas

ETAPE 1 — IDENTIFIER LES COLONNES :
Avant d'extraire les donnees, identifie TOUTES les colonnes du tableau d'amortissement. Liste-les dans le champ "_rawColumns".
Exemples de colonnes frequentes dans les tableaux bancaires francais :
  - "N°", "Rang", "Periode", "Echeance n°"
  - "Date", "Date d'echeance", "Echeance"
  - "Capital amorti", "Amortissement", "Remboursement capital", "Part capital", "Amort. Capital"
  - "Interets", "Part interets", "Frais financiers", "Int."
  - "Assurance", "Prime assurance", "Cotisation assurance", "Ass."
  - "Echeance", "Mensualite", "Annuite", "Total", "Echeance totale", "Ech. totale"
  - "Capital restant du", "CRD", "Solde", "Restant du", "Capital restant", "CRD apres"

ETAPE 2 — MAPPER LES COLONNES :
Chaque colonne du PDF doit correspondre a un champ JSON :
  - La colonne qui montre la PART DU CAPITAL REMBOURSE a chaque echeance => "principal"
    (montant qui, soustrait du solde precedent, donne le nouveau solde)
  - La colonne qui montre les INTERETS payes => "interest"
  - La colonne qui montre l'ASSURANCE => "insurance" (0 si absente ou colonne absente)
  - La colonne qui montre le MONTANT TOTAL de l'echeance => "total"
    LIS ce montant DIRECTEMENT dans le tableau — ne le calcule jamais
  - La colonne qui montre le CAPITAL RESTANT DU apres paiement => "balance"
    LIS ce montant DIRECTEMENT dans le tableau — ne le calcule jamais

IMPORTANT — NE PAS CONFONDRE :
  - "Capital restant du" (= balance, le solde qui diminue) N'EST PAS "Capital amorti" (= principal, la part remboursee)
  - Si le tableau montre que le total de chaque echeance = interets seuls (pas de remboursement de capital), le pret est IN_FINE
  - Si le tableau montre un capital amorti > 0 chaque mois et un solde qui diminue, le pret est AMORTISSABLE
  - Verifie que : balance[ligne N] = balance[ligne N-1] - principal[ligne N] (a quelques centimes pres)
  - Un ecart de quelques centimes est NORMAL en raison des arrondis bancaires — garder la valeur telle qu'elle apparait

REGLES :
- Si une information est absente, utilise null
- Les montants sont en euros avec POINT decimal (pas virgule) : "1 234,56" -> 1234.56
- Les espaces de milliers sont ignores : "249 280,13" -> 249280.13
- Les taux sont en pourcentage (3.5 pour 3,5%)
- Les dates au format "YYYY-MM-DD"
- Type de pret : "AMORTISSABLE" | "IN_FINE" | "BULLET"
- La duree = nombre total de lignes dans le tableau
- Exclure les lignes de resume/total
- EXTRAIRE TOUTES les lignes, meme si le tableau fait plus de 200 lignes

VERIFICATION FINALE :
- Si toutes les valeurs "principal" sont 0 et que le "balance" ne change jamais => verifie que tu n'as pas omis une colonne du tableau
- Si principal est toujours 0 mais que "total" > "interest" + "insurance" => principal = total - interest - insurance
- Le champ "total" DOIT etre identique au montant imprime dans le tableau bancaire

Retourne UNIQUEMENT ce JSON (sans markdown, sans explication) :
{
  "_rawColumns": ["liste", "des", "en-tetes", "de", "colonnes", "trouves"],
  "_rawFirstRow": {"col1_name": "val1", "col2_name": "val2"},
  "label": "libelle suggere pour cet emprunt",
  "lender": "nom de l'etablissement preteur",
  "loanType": "AMORTISSABLE|IN_FINE|BULLET",
  "amount": 250000.00,
  "interestRate": 3.50,
  "insuranceRate": 0.36,
  "durationMonths": 240,
  "startDate": "2024-01-15",
  "schedule": [
    {
      "period": 1,
      "dueDate": "2024-02-15",
      "principal": 719.87,
      "interest": 729.17,
      "insurance": 75.00,
      "total": 1524.04,
      "balance": 249280.13
    }
  ]
}

Si ce document n'est PAS un tableau d'amortissement bancaire, retourne : {"error": "Ce document ne semble pas etre un tableau d'amortissement bancaire"}
`;

export interface ParsedLoan {
  label: string | null;
  lender: string | null;
  loanType: "AMORTISSABLE" | "IN_FINE" | "BULLET";
  amount: number;
  interestRate: number;
  insuranceRate: number;
  durationMonths: number;
  startDate: string | null;
  schedule: Array<{
    period: number;
    dueDate: string;
    principal: number;
    interest: number;
    insurance: number;
    total: number;
    balance: number;
  }>;
}

function isLoanParsePdfDebugEnabled() {
  return env.LOAN_PARSE_PDF_DEBUG === "1";
}

function logLoanParsePdfError(error: unknown) {
  if (isLoanParsePdfDebugEnabled()) {
    console.error("[emprunts/parse-pdf]", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireActiveSocietyRouteContext({ minRole: "GESTIONNAIRE" });
    if (context instanceof NextResponse) return context;

    if (!env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Clé API Anthropic non configurée (ANTHROPIC_API_KEY manquante)" },
        { status: 503 }
      );
    }

    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    let fileBuffer: Buffer;
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const { storagePath } = (await req.json()) as { storagePath?: string };
      if (!storagePath || typeof storagePath !== "string") {
        return NextResponse.json({ error: "storagePath requis" }, { status: 400 });
      }
      const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
      }
      const supabase = createClient(supabaseUrl, supabaseKey);
      const bucket = env.SUPABASE_STORAGE_BUCKET ?? "documents";
      const { data, error } = await supabase.storage.from(bucket).download(storagePath);
      if (error || !data) {
        return NextResponse.json(
          { error: `Téléchargement Supabase impossible : ${error?.message ?? "données vides"}` },
          { status: 404 }
        );
      }
      fileBuffer = Buffer.from(await data.arrayBuffer());
      if (fileBuffer.byteLength > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Fichier trop volumineux (max 20 Mo)" },
          { status: 400 }
        );
      }
    } else {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
      }

      if (file.type !== "application/pdf") {
        return NextResponse.json(
          { error: "Seuls les fichiers PDF sont acceptés" },
          { status: 400 }
        );
      }

      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Fichier trop volumineux (max 20 Mo)" },
          { status: 400 }
        );
      }

      fileBuffer = Buffer.from(await file.arrayBuffer());
    }

    const pdfBase64 = fileBuffer.toString("base64");

    // Utiliser le streaming pour supporter les réponses longues (65536 tokens)
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 65536,
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
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const finalMessage = await stream.finalMessage();
    const rawText =
      finalMessage.content[0].type === "text" ? finalMessage.content[0].text.trim() : "";

    // Extraire le JSON de la réponse (au cas où Claude ajouterait du texte autour)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Impossible d'extraire les données du PDF" },
        { status: 422 }
      );
    }

    let parsed: ParsedLoan & { error?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]) as ParsedLoan & { error?: string };
    } catch {
      parsed = JSON.parse(jsonrepair(jsonMatch[0])) as ParsedLoan & { error?: string };
    }

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }

    // Normaliser les champs numeriques pour eviter les null/undefined cote client
    const sanitized: ParsedLoan = {
      label: parsed.label ?? null,
      lender: parsed.lender ?? null,
      loanType: parsed.loanType ?? "AMORTISSABLE",
      amount: Number(parsed.amount) || 0,
      interestRate: Number(parsed.interestRate) || 0,
      insuranceRate: Number(parsed.insuranceRate) || 0,
      durationMonths: Number(parsed.durationMonths) || 0,
      startDate: parsed.startDate ?? null,
      schedule: Array.isArray(parsed.schedule)
        ? parsed.schedule.map((line, i) => ({
            period: Number(line.period) || i + 1,
            dueDate: line.dueDate || "",
            principal: Number(line.principal) || 0,
            interest: Number(line.interest) || 0,
            insurance: Number(line.insurance) || 0,
            total: Number(line.total) || 0,
            balance: Number(line.balance) || 0,
          }))
        : [],
    };

    const allPrincipalZero =
      sanitized.schedule.length > 0 && sanitized.schedule.every((line) => line.principal === 0);
    const allBalanceConstant =
      sanitized.schedule.length > 1 &&
      sanitized.schedule.every((line) => line.balance === sanitized.schedule[0].balance);

    const response: { data: ParsedLoan; _debug?: Record<string, unknown> } = {
      data: sanitized,
    };

    if (isLoanParsePdfDebugEnabled()) {
      response._debug = {
        rawColumns: (parsed as unknown as Record<string, unknown>)._rawColumns ?? null,
        rawFirstRow: (parsed as unknown as Record<string, unknown>)._rawFirstRow ?? null,
        rawTextLength: rawText.length,
        linesExtracted: sanitized.schedule.length,
        allPrincipalZero,
        allBalanceConstant,
        detectedLoanType: sanitized.loanType,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logLoanParsePdfError(error);
    return NextResponse.json(
      { error: `Erreur lors de l'analyse du PDF : ${message}` },
      { status: 500 }
    );
  }
}
