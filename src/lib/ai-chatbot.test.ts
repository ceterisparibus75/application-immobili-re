import { describe, it, expect, vi, beforeEach } from "vitest"
import { chatWithAssistant, type ChatContext, type ChatMessage } from "@/lib/ai-chatbot"

/* ─── Mock Anthropic SDK ─────────────────────────────────────────── */

const mockCreate = vi.fn()
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

/* ─── Mock env ───────────────────────────────────────────────────── */

vi.mock("@/lib/env", () => ({
  env: { ANTHROPIC_API_KEY: "test-api-key" },
}))

/* ─── Helpers ────────────────────────────────────────────────────── */

const baseContext: ChatContext = {
  societyName: "SCI Test",
  userName: "Jean Dupont",
}

const contextWithScope: ChatContext = {
  ...baseContext,
  scope: {
    buildings: [{ name: "Résidence A", address: "1 rue de Paris", lotsCount: 10 }],
    tenants: [{ name: "Locataire X", unpaidAmount: 1200 }],
    leases: [{ tenant: "Locataire X", lot: "Apt 1", rent: 800, status: "EN_COURS" }],
    recentActivity: ["Facture #42 créée", "Paiement reçu de Locataire Y"],
  },
}

function makeAnthropicResponse(text: string) {
  return {
    content: [{ type: "text", text }],
  }
}

/* ─── Tests ──────────────────────────────────────────────────────── */

describe("chatWithAssistant", () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it("returns the assistant response text", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse("Bonjour, comment puis-je vous aider ?"))

    const messages: ChatMessage[] = [
      { role: "user", content: "Quelles sont les obligations du bailleur ?" },
    ]

    const result = await chatWithAssistant(messages, baseContext)
    expect(result).toBe("Bonjour, comment puis-je vous aider ?")
  })

  it("sends correct model and parameters to the API", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse("Réponse"))

    const messages: ChatMessage[] = [
      { role: "user", content: "Test" },
    ]

    await chatWithAssistant(messages, baseContext)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe("claude-sonnet-4-6")
    expect(callArgs.max_tokens).toBe(2048)
    expect(callArgs.messages).toEqual([{ role: "user", content: "Test" }])
  })

  it("includes society context in system prompt when scope is provided", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse("Réponse"))

    const messages: ChatMessage[] = [
      { role: "user", content: "Analyse" },
    ]

    await chatWithAssistant(messages, contextWithScope)

    const callArgs = mockCreate.mock.calls[0][0]
    const systemPrompt: string = callArgs.system

    // Verify society name and user name are in the prompt
    expect(systemPrompt).toContain("SCI Test")
    expect(systemPrompt).toContain("Jean Dupont")

    // Verify scope data is included
    expect(systemPrompt).toContain("Résidence A")
    expect(systemPrompt).toContain("1 rue de Paris")
    expect(systemPrompt).toContain("Locataire X")
    expect(systemPrompt).toContain("1200")
    expect(systemPrompt).toContain("Apt 1")
    expect(systemPrompt).toContain("Facture #42 créée")
  })

  it("does not include scope section when no scope provided", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse("Réponse"))

    await chatWithAssistant([{ role: "user", content: "Test" }], baseContext)

    const callArgs = mockCreate.mock.calls[0][0]
    const systemPrompt: string = callArgs.system
    expect(systemPrompt).not.toContain("Contexte de la société")
  })

  it("returns fallback message when response has no text block", async () => {
    mockCreate.mockResolvedValue({ content: [] })

    const result = await chatWithAssistant(
      [{ role: "user", content: "Test" }],
      baseContext,
    )

    expect(result).toBe("Désolé, je n'ai pas pu traiter votre demande.")
  })

  it("passes multiple messages in conversation order", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse("Réponse 3"))

    const messages: ChatMessage[] = [
      { role: "user", content: "Première question" },
      { role: "assistant", content: "Première réponse" },
      { role: "user", content: "Deuxième question" },
    ]

    await chatWithAssistant(messages, baseContext)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages).toHaveLength(3)
    expect(callArgs.messages[0]).toEqual({ role: "user", content: "Première question" })
    expect(callArgs.messages[1]).toEqual({ role: "assistant", content: "Première réponse" })
    expect(callArgs.messages[2]).toEqual({ role: "user", content: "Deuxième question" })
  })

  it("throws when ANTHROPIC_API_KEY is not configured", async () => {
    // Temporarily override env mock
    const envModule = await import("@/lib/env")
    const original = envModule.env.ANTHROPIC_API_KEY
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(envModule.env as any).ANTHROPIC_API_KEY = undefined

    await expect(
      chatWithAssistant([{ role: "user", content: "Test" }], baseContext)
    ).rejects.toThrow("ANTHROPIC_API_KEY non configurée")

    // Restore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(envModule.env as any).ANTHROPIC_API_KEY = original
  })

  it("propagates API errors", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit exceeded"))

    await expect(
      chatWithAssistant([{ role: "user", content: "Test" }], baseContext)
    ).rejects.toThrow("API rate limit exceeded")
  })
})
