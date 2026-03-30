import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

const EXTRACTION_PROMPT = `Tu es un expert comptable spécialisé dans l'analyse de tableaux d'amortissement de prêts immobiliers français.

Analyse ce document PDF et extrais les informations suivantes au format JSON strict.

RÈGLES :
- Si une information est absente, utilise null
- Les montants sont en euros (chiffres décimaux avec point)
- Les taux sont en pourcentage (ex: 3.5 pour 3,5%)
- Les dates sont au format "YYYY-MM-DD"
- Le type de prêt : "AMORTISSABLE" (annuités constantes), "IN_FINE" (intérêts seuls + capital en fin), "BULLET" (tout à l'échéance)
- La durée est le nombre total de lignes dans le tableau d'amortissement
- N'inclure QUE les lignes du tableau d'amortissement (exclure les lignes de résumé/total)

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

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
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

    const rawText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

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

    return NextResponse.json({ data: sanitized });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[parse-pdf]", message);
    return NextResponse.json(
      { error: `Erreur lors de l'analyse du PDF : ${message}` },
      { status: 500 }
    );
  }
}
