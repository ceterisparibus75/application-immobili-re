import { describe, it, expect, vi } from "vitest";

const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate };
  },
}));
vi.mock("@/lib/env", () => ({
  env: { ANTHROPIC_API_KEY: "sk-ant-test" },
}));
vi.mock("@/lib/ai-logger", () => ({
  logAiCall: vi.fn(),
}));

import { analyzeDocument, chatWithDocument } from "./document-ai";

function makeAnthropicResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

// ── analyzeDocument ────────────────────────────────────────────

describe("analyzeDocument", () => {
  it("parse correctement une réponse JSON valide", async () => {
    mockMessagesCreate.mockResolvedValue(
      makeAnthropicResponse(JSON.stringify({
        summary: "Contrat de bail pour appartement T3",
        tags: ["bail", "2025", "logement"],
        metadata: { loyer: 800, surface: 65 },
      }))
    );

    const result = await analyzeDocument(Buffer.from("pdf-content"), "application/pdf", "bail");
    expect(result.summary).toBe("Contrat de bail pour appartement T3");
    expect(result.tags).toEqual(["bail", "2025", "logement"]);
    expect(result.metadata).toMatchObject({ loyer: 800, surface: 65 });
  });

  it("retourne des valeurs par défaut si le JSON est absent", async () => {
    mockMessagesCreate.mockResolvedValue(makeAnthropicResponse("Désolé, je ne peux pas analyser ce document."));

    const result = await analyzeDocument(Buffer.from("content"), "image/jpeg", null);
    expect(result.summary).toBe("Analyse non disponible");
    expect(result.tags).toEqual([]);
    expect(result.metadata).toEqual({});
  });

  it("limite les tags à 10 éléments maximum", async () => {
    const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    mockMessagesCreate.mockResolvedValue(
      makeAnthropicResponse(JSON.stringify({ summary: "Test", tags: manyTags, metadata: {} }))
    );

    const result = await analyzeDocument(Buffer.from("content"), "application/pdf", null);
    expect(result.tags).toHaveLength(10);
  });

  it("utilise le hint de catégorie pour les documents connus", async () => {
    mockMessagesCreate.mockResolvedValue(makeAnthropicResponse("{}"));

    await analyzeDocument(Buffer.from("content"), "application/pdf", "bail");
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const textContent = callArgs.messages[0].content.find((c: { type: string; text?: string }) => c.type === "text");
    expect(textContent?.text).toContain("bail");
  });
});

// ── chatWithDocument ───────────────────────────────────────────

describe("chatWithDocument", () => {
  it("retourne la réponse textuelle du modèle", async () => {
    mockMessagesCreate.mockResolvedValue(makeAnthropicResponse("Le loyer mensuel est de 800 €."));

    const result = await chatWithDocument(Buffer.from("pdf"), "application/pdf", [
      { role: "user", content: "Quel est le montant du loyer ?" },
    ]);
    expect(result).toBe("Le loyer mensuel est de 800 €.");
  });

  it("retourne un message de fallback si la réponse est vide", async () => {
    mockMessagesCreate.mockResolvedValue({ content: [], usage: {} });

    const result = await chatWithDocument(Buffer.from("pdf"), "application/pdf", [
      { role: "user", content: "Question" },
    ]);
    expect(result).toContain("pas pu analyser");
  });
});
