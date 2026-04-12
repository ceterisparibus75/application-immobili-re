import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  generateLetter,
  type LetterGenerationInput,
  type GeneratedLetter,
} from "@/lib/ai-letter-generator"

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

const validLetterResponse: GeneratedLetter = {
  subject: "Mise en demeure de paiement",
  bodyHtml: "<p>Madame, Monsieur,</p><p>Je vous mets en demeure...</p>",
  legalReferences: ["Article 7 de la loi du 6 juillet 1989"],
  tone: "ferme",
  summary: "Mise en demeure pour loyers impayés de 3 mois",
}

function makeAnthropicResponse(json: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(json) }],
  }
}

const baseInput: LetterGenerationInput = {
  letterType: "mise_en_demeure",
  description: "Relance pour loyers impayés",
  context: {
    bailleurNom: "SCI Dupont",
    bailleurAdresse: "10 rue de la Paix, 75001 Paris",
    locataireNom: "Martin Durand",
    locataireAdresse: "5 avenue des Champs, 75008 Paris",
    bienAdresse: "5 avenue des Champs, 75008 Paris",
    loyerMontant: 1200,
    chargesMontant: 150,
    montantImpayes: 3600,
    periodesImpayees: "Janvier, Février, Mars 2024",
  },
}

const minimalInput: LetterGenerationInput = {
  letterType: "information",
  description: "Notification de travaux",
  context: {
    bailleurNom: "SCI Test",
    bailleurAdresse: "1 rue Test",
  },
}

/* ─── Tests ──────────────────────────────────────────────────────── */

describe("generateLetter", () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it("returns expected shape with all fields", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse(validLetterResponse))

    const result = await generateLetter(baseInput)

    expect(result).toHaveProperty("subject")
    expect(result).toHaveProperty("bodyHtml")
    expect(result).toHaveProperty("legalReferences")
    expect(result).toHaveProperty("tone")
    expect(result).toHaveProperty("summary")

    expect(result.subject).toBe("Mise en demeure de paiement")
    expect(result.bodyHtml).toContain("Madame, Monsieur")
    expect(result.legalReferences).toEqual(["Article 7 de la loi du 6 juillet 1989"])
    expect(result.tone).toBe("ferme")
    expect(result.summary).toContain("impayés")
  })

  it("sends the letter type and context to the API prompt", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse(validLetterResponse))

    await generateLetter(baseInput)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockCreate.mock.calls[0][0]
    const userMessage: string = callArgs.messages[0].content

    expect(userMessage).toContain("mise_en_demeure")
    expect(userMessage).toContain("SCI Dupont")
    expect(userMessage).toContain("Martin Durand")
    expect(userMessage).toContain("1200")
    expect(userMessage).toContain("3600")
    expect(userMessage).toContain("Janvier, Février, Mars 2024")
  })

  it("different letter types produce different prompts", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse(validLetterResponse))

    await generateLetter(baseInput)
    const prompt1: string = mockCreate.mock.calls[0][0].messages[0].content

    mockCreate.mockClear()

    const congeInput: LetterGenerationInput = {
      letterType: "conge_bailleur",
      description: "Congé pour reprise",
      context: {
        bailleurNom: "SCI Test",
        bailleurAdresse: "1 rue Test",
        locataireNom: "Tenant Test",
        dateFinBail: "2024-12-31",
      },
    }

    await generateLetter(congeInput)
    const prompt2: string = mockCreate.mock.calls[0][0].messages[0].content

    expect(prompt1).toContain("mise_en_demeure")
    expect(prompt2).toContain("conge_bailleur")
    expect(prompt1).not.toEqual(prompt2)
  })

  it("handles minimal context (missing optional fields) gracefully", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicResponse({
        subject: "Notification",
        bodyHtml: "<p>Contenu</p>",
        legalReferences: [],
        tone: "formel",
        summary: "Notification de travaux",
      })
    )

    const result = await generateLetter(minimalInput)

    expect(result.subject).toBe("Notification")
    expect(result.tone).toBe("formel")
    expect(result.legalReferences).toEqual([])

    // Verify that the prompt does not include undefined optional fields
    const userMessage: string = mockCreate.mock.calls[0][0].messages[0].content
    expect(userMessage).not.toContain("undefined")
  })

  it("provides defaults when AI returns incomplete JSON", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicResponse({ subject: "Objet partiel" })
    )

    const result = await generateLetter(baseInput)

    expect(result.subject).toBe("Objet partiel")
    expect(result.bodyHtml).toBe("<p>Le courrier n'a pas pu être généré.</p>")
    expect(result.legalReferences).toEqual([])
    expect(result.tone).toBe("formel")
    expect(result.summary).toBe("")
  })

  it("provides defaults when AI returns empty JSON", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse({}))

    const result = await generateLetter(baseInput)

    expect(result.subject).toBe("Courrier")
    expect(result.bodyHtml).toBe("<p>Le courrier n'a pas pu être généré.</p>")
    expect(result.legalReferences).toEqual([])
    expect(result.tone).toBe("formel")
    expect(result.summary).toBe("")
  })

  it("handles AI response wrapped in markdown code block", async () => {
    const wrappedResponse = `\`\`\`json\n${JSON.stringify(validLetterResponse)}\n\`\`\``
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: wrappedResponse }],
    })

    const result = await generateLetter(baseInput)

    expect(result.subject).toBe("Mise en demeure de paiement")
    expect(result.tone).toBe("ferme")
  })

  it("defaults invalid tone to 'formel'", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicResponse({ ...validLetterResponse, tone: "incorrect_tone" })
    )

    const result = await generateLetter(baseInput)
    expect(result.tone).toBe("formel")
  })

  it("defaults non-array legalReferences to empty array", async () => {
    mockCreate.mockResolvedValue(
      makeAnthropicResponse({ ...validLetterResponse, legalReferences: "not an array" })
    )

    const result = await generateLetter(baseInput)
    expect(result.legalReferences).toEqual([])
  })

  it("uses claude-sonnet-4-6 model with max_tokens 4096", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse(validLetterResponse))

    await generateLetter(baseInput)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe("claude-sonnet-4-6")
    expect(callArgs.max_tokens).toBe(4096)
  })

  it("throws when ANTHROPIC_API_KEY is not configured", async () => {
    const envModule = await import("@/lib/env")
    const original = envModule.env.ANTHROPIC_API_KEY
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(envModule.env as any).ANTHROPIC_API_KEY = undefined

    await expect(generateLetter(baseInput)).rejects.toThrow(
      "ANTHROPIC_API_KEY non configurée"
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(envModule.env as any).ANTHROPIC_API_KEY = original
  })

  it("includes extra context in prompt when provided", async () => {
    mockCreate.mockResolvedValue(makeAnthropicResponse(validLetterResponse))

    const inputWithExtra: LetterGenerationInput = {
      ...baseInput,
      context: {
        ...baseInput.context,
        extra: "Le locataire est souvent absent le matin",
      },
    }

    await generateLetter(inputWithExtra)

    const userMessage: string = mockCreate.mock.calls[0][0].messages[0].content
    expect(userMessage).toContain("Le locataire est souvent absent le matin")
  })
})
