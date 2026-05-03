export function payloadSha256FromEventPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const metadata = (payload as Record<string, unknown>)._mygestia;
  if (!metadata || typeof metadata !== "object") return null;

  const hash = (metadata as Record<string, unknown>).payloadSha256;
  return typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}
