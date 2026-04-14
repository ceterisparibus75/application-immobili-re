import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import type { ImportRow } from "@/actions/bank";

const PROMPT = `Tu es un expert en analyse de relevés bancaires français.
Analyse ce document PDF et extrait TOUTES les opérations bancaires.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après :

[
  {
    "transactionDate": "JJ/MM/AAAA",
    "amount": -123.45,
    "label": "Libellé complet de l'opération",
    "reference": "référence ou null"
  }
]

Règles strictes :
- "transactionDate" : format JJ/MM/AAAA (date de l'opération, pas de valeur)
- "amount" : nombre décimal. Débit/sortie = négatif. Crédit/entrée = positif.
- "label" : libellé complet de l'opération tel qu'il apparaît dans le relevé
- "reference" : numéro de référence, de virement ou d'opération si présent, sinon null
- Inclure TOUTES les opérations visibles, y compris les frais, virements, prélèvements
- Ne pas inclure les lignes de solde, totaux ou en-têtes de tableau
- Si une date est absente, utiliser la date la plus proche dans le contexte
- Ignorer les espaces et virgules comme séparateurs de milliers dans les montants

Réponds uniquement avec le JSON, rien d'autre.`;

type RawTransaction = {
  transactionDate?: string;
  amount?: unknown;
  label?: string;
  reference?: string | null;
};

export async function parsePdfBankStatement(
  fileBuffer: Buffer
): Promise<ImportRow[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY non configurée");
  }

  const anthropic = new Anthropic({ apiKey });
  const b64 = fileBuffer.toString("base64");

  const response = await anthropic.messages.create({
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
              data: b64,
            },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "[]";

  // Extraire le tableau JSON de la réponse
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  const jsonStr = arrayMatch?.[0] ?? "[]";

  let parsed: RawTransaction[];
  try {
    parsed = JSON.parse(jsonrepair(jsonStr)) as RawTransaction[];
  } catch {
    throw new Error("Le modèle IA n'a pas retourné un JSON valide");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Format de réponse IA inattendu");
  }

  const rows: ImportRow[] = [];
  for (const item of parsed) {
    if (!item.transactionDate || !item.label) continue;

    const amount =
      typeof item.amount === "number"
        ? item.amount
        : parseFloat(String(item.amount ?? "0").replace(/\s/g, "").replace(",", "."));

    if (isNaN(amount) || amount === 0) continue;

    rows.push({
      transactionDate: item.transactionDate,
      amount,
      label: String(item.label).trim(),
      reference: item.reference ?? undefined,
    });
  }

  return rows;
}
