import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

const EXTRACTION_PROMPT = `Tu es un expert comptable spécialisé dans l'analyse de tableaux d'amortissement de prêts immobiliers français.

Analyse ce document PDF et extrais les informations suivantes au format JSON strict.

ÉTAPE 1 — IDENTIFIER LES COLONNES :
Avant d'extraire les données, identifie TOUTES les colonnes du tableau d'amortissement. Liste-les dans le champ "_rawColumns".
Exemples de colonnes fréquentes dans les tableaux bancaires français :
  - "N°", "Rang", "Période", "Échéance n°"
  - "Date", "Date d'échéance", "Échéance"
  - "Capital amorti", "Amortissement", "Remboursement capital", "Part capital", "Amort. Capital"
  - "Intérêts", "Part intérêts", "Frais financiers", "Int."
  - "Assurance", "Prime assurance", "Cotisation assurance", "Ass."
  - "Échéance", "Mensualité", "Annuité", "Total", "Échéance totale", "Ech. totale"
  - "Capital restant dû", "CRD", "Solde", "Restant dû", "Capital restant", "CRD après"

ÉTAPE 2 — MAPPER LES COLONNES :
Chaque colonne du PDF doit correspondre à un champ JSON :
  - La colonne qui montre la PART DU CAPITAL REMBOURSÉ à chaque échéance → "principal"
    (C'est le montant qui, soustrait du solde précédent, donne le nouveau solde)
  - La colonne qui montre les INTÉRÊTS payés → "interest"
  - La colonne qui montre l'ASSURANCE → "insurance" (0 si absente)
  - La colonne qui montre le MONTANT TOTAL de l'échéance → "total"
    (total = principal + interest + insurance)
  - La colonne qui montre le CAPITAL RESTANT DÛ après paiement → "balance"
    (le solde diminue au fil des échéances dans un prêt amortissable)

IMPORTANT — NE PAS CONFONDRE :
  - "Capital restant dû" (= balance, le solde qui diminue) ≠ "Capital amorti" (= principal, la part remboursée)
  - Si le tableau montre que le total de chaque échéance = intérêts seuls (pas de remboursement de capital), le prêt est IN_FINE
  - Si le tableau montre un capital amorti > 0 chaque mois et un solde qui diminue, le prêt est AMORTISSABLE
  - Vérifie que : balance[ligne N] = balance[ligne N-1] - principal[ligne N]

RÈGLES :
- Si une information est absente, utilise null
- Les montants sont en euros avec POINT décimal (pas virgule) : "1 234,56" → 1234.56
- Les taux sont en pourcentage (3.5 pour 3,5%)
- Les dates au format "YYYY-MM-DD"
- Type de prêt : "AMORTISSABLE" | "IN_FINE" | "BULLET"
- La durée = nombre total de lignes dans le tableau
- Exclure les lignes de résumé/total
- EXTRAIRE TOUTES les lignes, même si le tableau fait plus de 200 lignes

VÉRIFICATION FINALE :
- Si toutes les valeurs "principal" sont 0 et que le "balance" ne change jamais → vérifie que tu n'as pas omis une colonne du tableau
- Si principal est toujours 0 mais que "total" > "interest" + "insurance" → principal = total - interest - insurance

Retourne UNIQUEMENT ce JSON (sans markdown, sans explication) :
{
  "_rawColumns": ["liste", "des", "en-têtes", "de", "colonnes", "trouvés"],
  "_rawFirstRow": {"col1_name": "val1", "col2_name": "val2"},
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
    console.log("[parse-pdf] Raw columns detected:", (parsed as Record<string, unknown>)._rawColumns);
    console.log("[parse-pdf] Raw first row:", (parsed as Record<string, unknown>)._rawFirstRow);
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
        rawColumns: (parsed as Record<string, unknown>)._rawColumns ?? null,
        rawFirstRow: (parsed as Record<string, unknown>)._rawFirstRow ?? null,
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
