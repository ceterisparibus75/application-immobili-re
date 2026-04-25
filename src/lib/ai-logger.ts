export type AiProvider = "anthropic" | "openai" | "gemini";

export interface AiCallMetrics {
  provider: AiProvider;
  model: string;
  operation: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  error?: string;
}

/**
 * Émet une ligne JSON structurée pour chaque appel LLM.
 * Filtrage recommandé en prod : `jq 'select(.service == "ai")'`
 */
export function logAiCall(metrics: AiCallMetrics): void {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "ai",
    provider: metrics.provider,
    model: metrics.model,
    operation: metrics.operation,
    durationMs: metrics.durationMs,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    totalTokens: (metrics.inputTokens ?? 0) + (metrics.outputTokens ?? 0),
    success: metrics.success,
    ...(metrics.error !== undefined && { error: metrics.error }),
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}
