import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { logAiCall } from "@/lib/ai-logger";
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
  logAiCall({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    operation: "callClaude/valuation",
    durationMs,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    success: true,
  });

  return { result, rawResponse, durationMs, tokenCount };
}

export async function callOpenAI(
  input: ValuationInput
): Promise<{ result: AiValuationResult; rawResponse: string; durationMs: number; tokenCount: number }> {
  assertOpenAIKey();

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY! });
  const userMessage = `Voici les données de l'immeuble à évaluer :\n\n${JSON.stringify(input, null, 2)}`;

  const start = Date.now();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: GEMINI_VALUATION_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  });

  const durationMs = Date.now() - start;
  const rawResponse = response.choices[0]?.message?.content ?? "";
  const tokenCount = (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0);
  const result = parseAiValuationResult(rawResponse);
  logAiCall({
    provider: "openai",
    model: "gpt-4o-mini",
    operation: "callOpenAI/valuation",
    durationMs,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    success: true,
  });

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
  logAiCall({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    operation: "callClaude/rentValuation",
    durationMs,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    success: true,
  });

  return { result, rawResponse, durationMs, tokenCount };
}

export async function callOpenAIRentValuation(
  input: RentValuationInput
): Promise<{ result: AiRentValuationResult; rawResponse: string; durationMs: number; tokenCount: number }> {
  assertOpenAIKey();

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY! });
  const userMessage = `Voici les données du bail à évaluer :\n\n${JSON.stringify(input, null, 2)}`;

  const start = Date.now();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: RENT_VALUATION_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  });

  const durationMs = Date.now() - start;
  const rawResponse = response.choices[0]?.message?.content ?? "";
  const tokenCount = (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0);
  const result = parseRentValuationResult(rawResponse);
  logAiCall({
    provider: "openai",
    model: "gpt-4o-mini",
    operation: "callOpenAI/rentValuation",
    durationMs,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    success: true,
  });

  return { result, rawResponse, durationMs, tokenCount };
}

// ============================================================
// EXTRACTION DE RAPPORT PDF
// ============================================================

export async function extractReportData(
  pdfBuffer: Buffer
): Promise<{ result: ExtractedReportData; rawResponse: string }> {
  assertAnthropicKey();

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
  const start = Date.now();

  if (textContent.length < 100) {
    return extractReportWithVision(client, pdfBuffer, start);
  }

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
  logAiCall({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    operation: "extractReportData/text",
    durationMs: Date.now() - start,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    success: true,
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
  pdfBuffer: Buffer,
  start: number
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
  logAiCall({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    operation: "extractReportData/vision",
    durationMs: Date.now() - start,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    success: true,
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

function extractAndRepairJson(raw: string): string {
  let cleaned = raw.trim();

  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }

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
    throw new Error("ANTHROPIC_API_KEY non configurée.");
  }
}

function assertOpenAIKey(): void {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY non configurée. Configurez la variable d'environnement pour utiliser GPT-4o.");
  }
}
