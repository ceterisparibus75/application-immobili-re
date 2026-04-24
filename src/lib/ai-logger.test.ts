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

describe("logAiCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("appelle console.log une fois", () => {
    logAiCall(BASE_METRICS);
    expect(console.log).toHaveBeenCalledOnce();
  });

  it("émet du JSON valide", () => {
    logAiCall(BASE_METRICS);
    const raw = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("inclut le champ service='ai'", () => {
    logAiCall(BASE_METRICS);
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(entry.service).toBe("ai");
  });

  it("inclut les champs provider, model, operation", () => {
    logAiCall(BASE_METRICS);
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(entry.provider).toBe("anthropic");
    expect(entry.model).toBe("claude-opus-4-7");
    expect(entry.operation).toBe("analyze_document");
  });

  it("calcule totalTokens = inputTokens + outputTokens", () => {
    logAiCall(BASE_METRICS);
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(entry.totalTokens).toBe(650);
  });

  it("totalTokens vaut 0 si inputTokens et outputTokens sont absents", () => {
    logAiCall({ ...BASE_METRICS, inputTokens: undefined, outputTokens: undefined });
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(entry.totalTokens).toBe(0);
  });

  it("inclut le champ error si fourni", () => {
    logAiCall({ ...BASE_METRICS, success: false, error: "API timeout" });
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(entry.error).toBe("API timeout");
    expect(entry.success).toBe(false);
  });

  it("n'inclut pas le champ error si absent", () => {
    logAiCall(BASE_METRICS);
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect("error" in entry).toBe(false);
  });

  it("inclut un timestamp ISO 8601", () => {
    logAiCall(BASE_METRICS);
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("fonctionne avec le provider openai", () => {
    logAiCall({ ...BASE_METRICS, provider: "openai", model: "gpt-4o" });
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(entry.provider).toBe("openai");
  });

  it("inclut durationMs dans la sortie", () => {
    logAiCall({ ...BASE_METRICS, durationMs: 9999 });
    const entry = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(entry.durationMs).toBe(9999);
  });
});
