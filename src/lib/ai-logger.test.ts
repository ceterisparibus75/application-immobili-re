import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAiCall, type AiCallMetrics } from "./ai-logger";

const BASE_METRICS: AiCallMetrics = {
  provider: "anthropic",
  model: "claude-opus-4-7",
  operation: "analyze_document",
  durationMs: 1234,
  inputTokens: 500,
  outputTokens: 150,
  success: true,
};

function getLastEntry(): Record<string, unknown> {
  const writeSpy = vi.mocked(process.stdout.write);
  const lastCall = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
  return JSON.parse((lastCall[0] as string).trimEnd());
}

describe("logAiCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  it("appelle process.stdout.write une fois", () => {
    logAiCall(BASE_METRICS);
    expect(process.stdout.write).toHaveBeenCalledOnce();
  });

  it("émet du JSON valide", () => {
    logAiCall(BASE_METRICS);
    expect(() => getLastEntry()).not.toThrow();
  });

  it("inclut le champ service='ai'", () => {
    logAiCall(BASE_METRICS);
    expect(getLastEntry().service).toBe("ai");
  });

  it("inclut les champs provider, model, operation", () => {
    logAiCall(BASE_METRICS);
    const entry = getLastEntry();
    expect(entry.provider).toBe("anthropic");
    expect(entry.model).toBe("claude-opus-4-7");
    expect(entry.operation).toBe("analyze_document");
  });

  it("calcule totalTokens = inputTokens + outputTokens", () => {
    logAiCall(BASE_METRICS);
    expect(getLastEntry().totalTokens).toBe(650);
  });

  it("totalTokens vaut 0 si inputTokens et outputTokens sont absents", () => {
    logAiCall({ ...BASE_METRICS, inputTokens: undefined, outputTokens: undefined });
    expect(getLastEntry().totalTokens).toBe(0);
  });

  it("inclut le champ error si fourni", () => {
    logAiCall({ ...BASE_METRICS, success: false, error: "API timeout" });
    const entry = getLastEntry();
    expect(entry.error).toBe("API timeout");
    expect(entry.success).toBe(false);
  });

  it("n'inclut pas le champ error si absent", () => {
    logAiCall(BASE_METRICS);
    expect("error" in getLastEntry()).toBe(false);
  });

  it("inclut un timestamp ISO 8601", () => {
    logAiCall(BASE_METRICS);
    expect(String(getLastEntry().timestamp)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("fonctionne avec le provider openai", () => {
    logAiCall({ ...BASE_METRICS, provider: "openai", model: "gpt-4o" });
    expect(getLastEntry().provider).toBe("openai");
  });

  it("inclut durationMs dans la sortie", () => {
    logAiCall({ ...BASE_METRICS, durationMs: 9999 });
    expect(getLastEntry().durationMs).toBe(9999);
  });
});
