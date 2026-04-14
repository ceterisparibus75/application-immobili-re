import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

export interface SupplierInvoiceAIResult {
  supplierName: string | null;
  supplierSiret: string | null;
  supplierAddress: string | null;
  supplierIban: string | null;   // brut, sans espaces
  supplierBic: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;    // YYYY-MM-DD
  dueDate: string | null;        // YYYY-MM-DD
  amountHT: number | null;
  amountVAT: number | null;
  amountTTC: number | null;
  vatRate: number | null;        // ex: 20
  currency: string;
  description: string | null;
  periodStart: string | null;    // YYYY-MM-DD
  periodEnd: string | null;      // YYYY-MM-DD
  confidence: number;            // 0-1
}

const EMPTY_RESULT: SupplierInvoiceAIResult = {
  supplierName: null,
  supplierSiret: null,
  supplierAddress: null,
  supplierIban: null,
  supplierBic: null,
  invoiceNumber: null,
  invoiceDate: null,
  dueDate: null,
  amountHT: null,
  amountVAT: null,
  amountTTC: null,
  vatRate: null,
  currency: "EUR",
  description: null,
  periodStart: null,
  periodEnd: null,
  confidence: 0,
};

// Nombre total de champs analysés pour le calcul de la confiance (hors currency et confidence)
const TOTAL_FIELDS = 16;

function buildContentBlock(fileBuffer: Buffer, mime: string) {
  const b64 = fileBuffer.toString("base64");
  if (mime === "application/pdf") {
    return {
      type: "document" as const,
      source: { type: "base64" as const, media_type: "application/pdf" as const, data: b64 },
    };
  }
  const imageType = mime === "image/png"
    ? "image/png" as const
    : mime === "image/webp"
      ? "image/webp" as const
      : "image/jpeg" as const;
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: imageType, data: b64 },
  };
}

/**
 * Analyse une facture fournisseur (PDF ou image) et extrait ses informations clés via l'IA Claude.
 * Retourne un résultat vide avec confidence 0 si le parsing échoue.
 * Lève une erreur si ANTHROPIC_API_KEY est absente.
 */
export async function analyzeSupplierInvoice(
  buffer: Buffer,
  mimeType: string
): Promise<SupplierInvoiceAIResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquante");
  }

  const prompt = `Tu es un expert en comptabilité et gestion immobilière française. Analyse cette facture fournisseur et réponds en JSON valide uniquement, sans aucun texte avant ou après.

Extrais EXACTEMENT ces champs :
{
  "supplierName": "Nom du fournisseur ou null",
  "supplierSiret": "Numéro SIRET (14 chiffres sans espaces) ou null",
  "supplierAddress": "Adresse complète du fournisseur ou null",
  "supplierIban": "IBAN du fournisseur sans espaces ou null",
  "supplierBic": "BIC/SWIFT du fournisseur ou null",
  "invoiceNumber": "Numéro de facture ou null",
  "invoiceDate": "Date de la facture au format YYYY-MM-DD ou null",
  "dueDate": "Date d'échéance au format YYYY-MM-DD ou null",
  "amountHT": "Montant HT en nombre décimal (ex: 1000.00) ou null",
  "amountVAT": "Montant TVA en nombre décimal ou null",
  "amountTTC": "Montant TTC en nombre décimal ou null",
  "vatRate": "Taux de TVA en pourcentage (ex: 20) ou null",
  "currency": "Devise (ex: EUR) — EUR par défaut si non précisé",
  "description": "Description de la prestation ou des produits facturés ou null",
  "periodStart": "Début de la période de prestation au format YYYY-MM-DD ou null",
  "periodEnd": "Fin de la période de prestation au format YYYY-MM-DD ou null"
}

Règles importantes :
- L'IBAN doit être sans espaces (retire tous les espaces)
- Les montants sont des nombres décimaux, pas des chaînes
- Les dates sont au format YYYY-MM-DD
- Si une information n'est pas présente dans le document, utilise null
- Ne devine pas : si tu n'es pas sûr, mets null`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            buildContentBlock(buffer, mimeType),
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    let parsed: Partial<SupplierInvoiceAIResult>;
    try {
      parsed = JSON.parse(jsonrepair(jsonMatch?.[0] ?? "{}")) as Partial<SupplierInvoiceAIResult>;
    } catch {
      return { ...EMPTY_RESULT };
    }

    // Nettoyage de l'IBAN (suppression des espaces résiduels)
    if (parsed.supplierIban) {
      parsed.supplierIban = parsed.supplierIban.replace(/\s/g, "");
    }

    // Calcul de la confiance : nombre de champs non-null / TOTAL_FIELDS
    const fields: (keyof Omit<SupplierInvoiceAIResult, "currency" | "confidence">)[] = [
      "supplierName",
      "supplierSiret",
      "supplierAddress",
      "supplierIban",
      "supplierBic",
      "invoiceNumber",
      "invoiceDate",
      "dueDate",
      "amountHT",
      "amountVAT",
      "amountTTC",
      "vatRate",
      "description",
      "periodStart",
      "periodEnd",
    ];

    // TOTAL_FIELDS = 16, mais on liste 15 ici car supplierName compte double en importance — on garde 16 comme base fixe
    const nonNullCount = fields.filter((f) => parsed[f] !== null && parsed[f] !== undefined).length;
    const confidence = Math.min(nonNullCount / TOTAL_FIELDS, 1);

    return {
      supplierName: parsed.supplierName ?? null,
      supplierSiret: parsed.supplierSiret ?? null,
      supplierAddress: parsed.supplierAddress ?? null,
      supplierIban: parsed.supplierIban ?? null,
      supplierBic: parsed.supplierBic ?? null,
      invoiceNumber: parsed.invoiceNumber ?? null,
      invoiceDate: parsed.invoiceDate ?? null,
      dueDate: parsed.dueDate ?? null,
      amountHT: parsed.amountHT ?? null,
      amountVAT: parsed.amountVAT ?? null,
      amountTTC: parsed.amountTTC ?? null,
      vatRate: parsed.vatRate ?? null,
      currency: typeof parsed.currency === "string" && parsed.currency.length > 0
        ? parsed.currency
        : "EUR",
      description: parsed.description ?? null,
      periodStart: parsed.periodStart ?? null,
      periodEnd: parsed.periodEnd ?? null,
      confidence,
    };
  } catch {
    return { ...EMPTY_RESULT };
  }
}
