import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

const EXTRACTION_PROMPT = `Tu es un expert comptable spécialisé dans l'analyse de tableaux d'amortissement de prêts immobiliers français.

Analyse ce document PDF et extrais les informations suivantes au format JSON strict.

CORRESPONDANCE DES COLONNES (les tableaux bancaires français utilisent ces noms) :
- "Amortissement" ou "Capital amorti" ou "Remboursement capital" ou "Part capital" → champ "principal"
- "Intérêts" ou "Part intérêts" ou "Frais financiers" → champ "interest"
- "Assurance" ou "Prime assurance" ou "Cotisation assurance" → champ "insurance"
- "Échéance" ou "Mensualité" ou "Annuité" ou "Total" → champ "total"
- "Capital restant dû" ou "CRD" ou "Solde" ou "Restant dû" ou "Capital restant" → champ "balance"
- "N°" ou "Période" ou "Mois" ou "Rang" → champ "period"
- "Date" ou "Date d'échéance" → champ "dueDate"

ATTENTION : Dans un prêt AMORTISSABLE, le capital amorti (principal) est TOUJOURS > 0 (sauf éventuellement la toute première échéance de pré-amortissement). Si tu vois une colonne avec des montants qui diminuent progressivement le solde restant dû, c'est la colonne "principal". Ne confonds PAS le capital emprunté total avec le capital amorti par échéance.

RÈGLES :
- Si une information est absente, utilise null
- Les montants sont en euros (chiffres décimaux avec point, PAS de virgule)
- Convertir les virgules françaises en points : "1 234,56" → 1234.56
- Les taux sont en pourcentage (ex: 3.5 pour 3,5%)
- Les dates sont au format "YYYY-MM-DD"
- Le type de prêt : "AMORTISSABLE" (annuités constantes, le capital restant diminue chaque mois), "IN_FINE" (intérêts seuls + capital remboursé en une fois à la fin), "BULLET" (tout à l'échéance)
- La durée est le nombre total de lignes dans le tableau d'amortissement
- N'inclure QUE les lignes du tableau d'amortissement (exclure les lignes de résumé/total)
- IMPORTANT : Tu DOIS extraire TOUTES les lignes du tableau, de la première à la dernière échéance, sans en omettre aucune, même si le tableau fait plus de 200 lignes
- VÉRIFICATION : si le solde (balance) ne change jamais entre les lignes, c'est que tu n'as pas correctement identifié la colonne "principal" — relis le tableau attentivement

Retourne UNIQUEMENT ce JSON (sans markdown, sans explication) :
{
  "label": "libellé suggéré pour cet emprunt",
  "lender": "nom de l'établissement prêteur",
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

Si ce document n'est PAS un tableau d'amortissement bancaire, retourne : {"error": "Ce document ne semble pas être un tableau d'amortissement bancaire"}`;

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

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Clé API Anthropic non configurée (ANTHROPIC_API_KEY manquante)" },
        { status: 500 }
      );
    }

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

    try {
      await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");
    } catch (e) {
      if (e instanceof ForbiddenError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

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

    const fileBuffer = Buffer.from(await file.arrayBuffer());
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

    // Log pour diagnostic
    console.log("[parse-pdf] AI response length:", rawText.length);
    console.log("[parse-pdf] AI response (first 1000 chars):", rawText.substring(0, 1000));

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

    // Diagnostic : vérifier si le capital est détecté
    const allPrincipalZero = sanitized.schedule.length > 0 && sanitized.schedule.every(l => l.principal === 0);
    const allBalanceConstant = sanitized.schedule.length > 1 && sanitized.schedule.every(l => l.balance === sanitized.schedule[0].balance);
    console.log("[parse-pdf] Stats:", {
      lines: sanitized.schedule.length,
      loanType: sanitized.loanType,
      allPrincipalZero,
      allBalanceConstant,
      firstLine: sanitized.schedule[0],
      lastLine: sanitized.schedule[sanitized.schedule.length - 1],
    });

    return NextResponse.json({
      data: sanitized,
      _debug: {
        rawTextLength: rawText.length,
        linesExtracted: sanitized.schedule.length,
        allPrincipalZero,
        allBalanceConstant,
        detectedLoanType: sanitized.loanType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[parse-pdf]", message);
    return NextResponse.json(
      { error: `Erreur lors de l'analyse du PDF : ${message}` },
      { status: 500 }
    );
  }
}
