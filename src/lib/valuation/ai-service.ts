import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { jsonrepair } from "jsonrepair";
import { env } from "@/lib/env";
import { CLAUDE_VALUATION_SYSTEM_PROMPT } from "./prompts/claude-valuation";
import { GEMINI_VALUATION_SYSTEM_PROMPT } from "./prompts/gemini-valuation";
import { REPORT_EXTRACTION_PROMPT, RENT_VALUATION_SYSTEM_PROMPT } from "./prompts/report-extraction";
import type {
  ValuationInput,
  AiValuationResult,
  RentValuationInput,
  AiRentValuationResult,
  ExtractedReportData,
} from "./types";

// ============================================================
// ÉVALUATION IMMOBILIÈRE (Valeur Vénale)
// ============================================================

export async function callClaude(
  input: ValuationInput
): Promise<{ result: AiValuationResult; rawResponse: string; durationMs: number; tokenCount: number }> {
  assertAnthropicKey();

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const userMessage = `Voici les données de l'immeuble à évaluer :\n\n${JSON.stringify(input, null, 2)}`;

  const start = Date.now();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: CLAUDE_VALUATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const durationMs = Date.now() - start;
  const rawResponse = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const tokenCount = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
  const result = parseAiValuationResult(rawResponse);

  return { result, rawResponse, durationMs, tokenCount };
}

export async function callGemini(
  input: ValuationInput
): Promise<{ result: AiValuationResult; rawResponse: string; durationMs: number; tokenCount: number }> {
  assertGoogleKey();

  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: GEMINI_VALUATION_SYSTEM_PROMPT,
  });

  const userMessage = `Voici les données de l'immeuble à évaluer :\n\n${JSON.stringify(input, null, 2)}`;

  const start = Date.now();
  const response = await model.generateContent(userMessage);
  const durationMs = Date.now() - start;

  const rawResponse = response.response.text();
  const tokenCount =
    (response.response.usageMetadata?.promptTokenCount ?? 0) +
    (response.response.usageMetadata?.candidatesTokenCount ?? 0);

  const result = parseAiValuationResult(rawResponse);

  return { result, rawResponse, durationMs, tokenCount };
}

// ============================================================
// ÉVALUATION DES LOYERS
// ============================================================

export async function callClaudeRentValuation(
  input: RentValuationInput
): Promise<{ result: AiRentValuationResult; rawResponse: string; durationMs: number; tokenCount: number }> {
  assertAnthropicKey();

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const userMessage = `Voici les données du bail à évaluer :\n\n${JSON.stringify(input, null, 2)}`;

  const start = Date.now();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: RENT_VALUATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const durationMs = Date.now() - start;
  const rawResponse = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const tokenCount = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
  const result = parseRentValuationResult(rawResponse);

  return { result, rawResponse, durationMs, tokenCount };
}

export async function callGeminiRentValuation(
  input: RentValuationInput
): Promise<{ result: AiRentValuationResult; rawResponse: string; durationMs: number; tokenCount: number }> {
  assertGoogleKey();

  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: RENT_VALUATION_SYSTEM_PROMPT,
  });

  const userMessage = `Voici les données du bail à évaluer :\n\n${JSON.stringify(input, null, 2)}`;

  const start = Date.now();
  const response = await model.generateContent(userMessage);
  const durationMs = Date.now() - start;

  const rawResponse = response.response.text();
  const tokenCount =
    (response.response.usageMetadata?.promptTokenCount ?? 0) +
    (response.response.usageMetadata?.candidatesTokenCount ?? 0);

  const result = parseRentValuationResult(rawResponse);

  return { result, rawResponse, durationMs, tokenCount };
}

// ============================================================
// EXTRACTION DE RAPPORT PDF
// ============================================================

/**
 * Extrait les données structurées d'un rapport d'expertise PDF.
 * Approche hybride : texte d'abord, vision Claude si le texte est trop court.
 */
export async function extractReportData(
  pdfBuffer: Buffer
): Promise<{ result: ExtractedReportData; rawResponse: string }> {
  assertAnthropicKey();

  // Tentative 1 : extraction textuelle via pdf-parse
  let textContent = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(pdfBuffer);
    textContent = parsed.text;
  } catch {
    // pdf-parse peut échouer sur certains PDFs
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // Si texte trop court, fallback vers Claude Vision
  if (textContent.length < 100) {
    return extractReportWithVision(client, pdfBuffer);
  }

  // Extraction via texte
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: REPORT_EXTRACTION_PROMPT,
    messages: [
      {
        role: "user",
        content: `Voici le contenu textuel extrait du rapport d'expertise PDF :\n\n${textContent.substring(0, 50000)}`,
      },
    ],
  });

  const rawResponse = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const result = parseExtractedReport(rawResponse);
  return { result, rawResponse };
}

async function extractReportWithVision(
  client: Anthropic,
  pdfBuffer: Buffer
): Promise<{ result: ExtractedReportData; rawResponse: string }> {
  const base64Pdf = pdfBuffer.toString("base64");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: REPORT_EXTRACTION_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            type: "text",
            text: "Extrais les informations clés de ce rapport d'expertise immobilière.",
          },
        ],
      },
    ],
  });

  const rawResponse = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const result = parseExtractedReport(rawResponse);
  return { result, rawResponse };
}

// ============================================================
// PARSING HELPERS
// ============================================================

function parseAiValuationResult(raw: string): AiValuationResult {
  const json = extractAndRepairJson(raw);
  const parsed = JSON.parse(json) as AiValuationResult;

  // Vérification minimale de la structure
  if (!parsed.summary || typeof parsed.summary.estimatedValueMid !== "number") {
    throw new Error("Réponse IA invalide : champ summary.estimatedValueMid manquant");
  }

  return parsed;
}

function parseRentValuationResult(raw: string): AiRentValuationResult {
  const json = extractAndRepairJson(raw);
  const parsed = JSON.parse(json) as AiRentValuationResult;

  if (!parsed.summary || typeof parsed.summary.estimatedMarketRent !== "number") {
    throw new Error("Réponse IA invalide : champ summary.estimatedMarketRent manquant");
  }

  return parsed;
}

function parseExtractedReport(raw: string): ExtractedReportData {
  const json = extractAndRepairJson(raw);
  return JSON.parse(json) as ExtractedReportData;
}

/**
 * Extrait le JSON d'une réponse potentiellement enveloppée dans du markdown,
 * et utilise jsonrepair pour corriger les erreurs mineures.
 */
function extractAndRepairJson(raw: string): string {
  let cleaned = raw.trim();

  // Retirer les blocs markdown ```json ... ```
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }

  // Trouver le premier { et le dernier }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return jsonrepair(cleaned);
  } catch {
    return cleaned;
  }
}

// ============================================================
// ASSERTIONS
// ============================================================

function assertAnthropicKey(): void {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non configurée. Configurez la variable d'environnement pour utiliser les évaluations IA.");
  }
}

function assertGoogleKey(): void {
  if (!env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY non configurée. Configurez la variable d'environnement pour utiliser Gemini.");
  }
}
