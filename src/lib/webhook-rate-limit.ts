import { NextRequest, NextResponse } from "next/server";
import { getApiRatelimit } from "@/lib/rate-limit";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}

export async function enforceWebhookRateLimit(
  request: NextRequest,
  provider: string
): Promise<NextResponse | null> {
  const limiter = getApiRatelimit();
  const result = await limiter.limit(`webhook:${provider}:${getClientIp(request)}`);

  if (result.success) {
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Trop de requêtes" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}
