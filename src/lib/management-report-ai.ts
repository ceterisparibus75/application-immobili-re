import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";

// Types pour les resultats d analyse IA

export interface ManagementReportAIResult {
  periodStart: string | null;
  periodEnd: string | null;
  grossRent: number | null;
  chargesAmount: number | null;
  feeAmountHT: number | null;
  feeAmountTTC: number | null;
  netTransfer: number | null;
  agencyName: string | null;
  alerts: string[];
  confidence: number;
}

export interface AgencyInvoiceAIResult {
  montantHT: number | null;
  tva: number | null;
  montantTTC: number | null;
  agencyName: string | null;
  invoiceNumber: string | null;
  period: string | null;
  date: string | null;
  confidence: number;
}

export interface LeaseContext {
  tenantName: string;
  lotLabel: string;
  currentRentHT: number;
  managementFeeValue: number;
  managementFeeType: string;
}

// Helper pour construire le bloc de contenu (meme pattern que document-ai.ts)
function mediaType(mime: string): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" {
  if (mime === "application/pdf") return "application/pdf";
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
}

function buildContentBlock(fileBuffer: Buffer, mime: string) {
  const b64 = fileBuffer.toString("base64");
  const mt = mediaType(mime);
  if (mt === "application/pdf") {
    return { type: "document" as const, source: { type: "base64" as const, media_type: mt, data: b64 } };
  }
  return { type: "image" as const, source: { type: "base64" as const, media_type: mt, data: b64 } };
}

// Analyse un compte-rendu de gestion (PDF ou image) et compare avec le contexte du bail
export async function analyzeManagementReport(
  fileBuffer: Buffer,
  mimeType: string,
  leaseContext: LeaseContext
): Promise<ManagementReportAIResult> {
  const feeDescription = leaseContext.managementFeeType === "POURCENTAGE"
    ? `${leaseContext.managementFeeValue}% du loyer`
    : `${leaseContext.managementFeeValue} EUR forfaitaire`;

  const prompt = `Tu es un expert en gestion immobiliere francaise. Analyse ce compte-rendu de gestion locative et reponds en JSON valide uniquement.

Contexte du bail :
- Locataire : ${leaseContext.tenantName}
- Lot : ${leaseContext.lotLabel}
- Loyer HT attendu : ${leaseContext.currentRentHT} EUR
- Honoraires de gestion prevus : ${feeDescription}

Extrais les informations suivantes du document :
1. periodStart : date de debut de la periode (format YYYY-MM-DD si possible)
2. periodEnd : date de fin de la periode (format YYYY-MM-DD si possible)
3. grossRent : loyer brut encaisse (nombre)
4. chargesAmount : montant des charges encaissees (nombre, null si absent)
5. feeAmountHT : honoraires de gestion HT (nombre)
6. feeAmountTTC : honoraires de gestion TTC (nombre)
7. netTransfer : montant net vire au proprietaire (nombre)
8. agencyName : nom de l agence de gestion

Compare les montants extraits avec le contexte du bail et signale toute anomalie :
- Le loyer brut correspond-il au loyer HT attendu ?
- Les honoraires correspondent-ils au taux ou forfait prevu ?
- Le montant net est-il coherent (loyer + charges - honoraires) ?

Reponds avec ce JSON (et rien d autre) :
{
  "periodStart": "YYYY-MM-DD ou null",
  "periodEnd": "YYYY-MM-DD ou null",
  "grossRent": 0,
  "chargesAmount": 0,
  "feeAmountHT": 0,
  "feeAmountTTC": 0,
  "netTransfer": 0,
  "agencyName": "nom ou null",
  "alerts": ["description de chaque anomalie detectee"],
  "confidence": 0.95
}

Pour confidence : score entre 0 et 1 indiquant la fiabilite de l extraction.
Si une information n est pas trouvee, mets null pour les champs texte et 0 pour les nombres.
Les alertes doivent etre en francais et precises (montant attendu vs montant trouve).`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          buildContentBlock(fileBuffer, mimeType),
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonrepair(jsonMatch?.[0] ?? "{}")) as Partial<ManagementReportAIResult>;

  return {
    periodStart: parsed.periodStart ?? null,
    periodEnd: parsed.periodEnd ?? null,
    grossRent: typeof parsed.grossRent === "number" ? parsed.grossRent : null,
    chargesAmount: typeof parsed.chargesAmount === "number" ? parsed.chargesAmount : null,
    feeAmountHT: typeof parsed.feeAmountHT === "number" ? parsed.feeAmountHT : null,
    feeAmountTTC: typeof parsed.feeAmountTTC === "number" ? parsed.feeAmountTTC : null,
    netTransfer: typeof parsed.netTransfer === "number" ? parsed.netTransfer : null,
    agencyName: parsed.agencyName ?? null,
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
  };
}

// Analyse une facture d honoraires d agence (PDF ou image)
export async function analyzeAgencyInvoice(
  fileBuffer: Buffer,
  mimeType: string
): Promise<AgencyInvoiceAIResult> {
  const prompt = `Tu es un expert en gestion immobiliere francaise. Analyse cette facture d honoraires de gestion et reponds en JSON valide uniquement.

Extrais les informations suivantes :
1. montantHT : montant hors taxes (nombre)
2. tva : montant de la TVA (nombre)
3. montantTTC : montant toutes taxes comprises (nombre)
4. agencyName : nom de l agence ou du prestataire
5. invoiceNumber : numero de facture
6. period : periode concernee (ex: "Janvier 2026", "T1 2026")
7. date : date de la facture (format YYYY-MM-DD si possible)

Reponds avec ce JSON (et rien d autre) :
{
  "montantHT": 0,
  "tva": 0,
  "montantTTC": 0,
  "agencyName": "nom ou null",
  "invoiceNumber": "numero ou null",
  "period": "periode ou null",
  "date": "YYYY-MM-DD ou null",
  "confidence": 0.95
}

Pour confidence : score entre 0 et 1 indiquant la fiabilite de l extraction.
Si une information n est pas trouvee, mets null pour les champs texte et 0 pour les nombres.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          buildContentBlock(fileBuffer, mimeType),
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonrepair(jsonMatch?.[0] ?? "{}")) as Partial<AgencyInvoiceAIResult>;

  return {
    montantHT: typeof parsed.montantHT === "number" ? parsed.montantHT : null,
    tva: typeof parsed.tva === "number" ? parsed.tva : null,
    montantTTC: typeof parsed.montantTTC === "number" ? parsed.montantTTC : null,
    agencyName: parsed.agencyName ?? null,
    invoiceNumber: parsed.invoiceNumber ?? null,
    period: parsed.period ?? null,
    date: parsed.date ?? null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
  };
}
