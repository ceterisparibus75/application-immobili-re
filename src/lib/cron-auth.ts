import { timingSafeEqual } from "crypto";

/**
 * Verify a CRON_SECRET using constant-time comparison to prevent timing attacks.
 * Returns true if the provided value matches the expected CRON_SECRET.
 */
export function verifyCronSecret(provided: string | null | undefined): boolean {
  const expected = process.env.CRON_SECRET;
  if (!provided || !expected) return false;

  // Extract the token from "Bearer <token>" format if present
  const token = provided.startsWith("Bearer ") ? provided.slice(7) : provided;

  if (token.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
