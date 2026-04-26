/**
 * Utilitaire de retry avec backoff exponentiel et jitter.
 * Usage : await withRetry(() => resend.emails.send(...), { retries: 3 })
 */

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("econnreset") || msg.includes("enotfound") || msg.includes("etimedout") || msg.includes("socket")) return true;
    const status = (error as { status?: number; statusCode?: number }).status
      ?? (error as { status?: number; statusCode?: number }).statusCode;
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 3, baseDelayMs = 300, maxDelayMs = 10_000, shouldRetry = isRetryableError } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) throw error;
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(baseDelayMs * 2 ** attempt + jitter, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
