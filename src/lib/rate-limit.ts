import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (url && token) {
      _redis = new Redis({ url, token });
    } else {
      return null;
    }
  }
  return _redis;
}

/**
 * Rate limiter en mémoire pour les environnements sans Redis.
 * Limite basique par IP avec fenêtre glissante.
 */
class InMemoryRateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async limit(key: string): Promise<{ success: boolean; reset: number }> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { success: true, reset: now + this.windowMs };
    }

    entry.count++;
    if (entry.count > this.maxRequests) {
      return { success: false, reset: entry.resetAt };
    }
    return { success: true, reset: entry.resetAt };
  }
}

// Fallback in-memory limiters (pour dev/staging sans Redis)
const inMemoryLoginLimiter = new InMemoryRateLimiter(3, 10_000);
const inMemoryApiLimiter = new InMemoryRateLimiter(10, 10_000);
const inMemory2FALimiter = new InMemoryRateLimiter(5, 60_000);
const inMemoryPortalLimiter = new InMemoryRateLimiter(5, 300_000);

type RateLimiterLike = { limit: (key: string) => Promise<{ success: boolean; reset: number }> };

/** Login : 3 tentatives par 10 secondes par IP */
export function getLoginRatelimit(): RateLimiterLike {
  const redis = getRedis();
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "10 s"),
      analytics: false,
      prefix: "rl:login",
    });
  }
  return inMemoryLoginLimiter;
}

/** API generale : 10 requetes par 10 secondes par IP */
export function getApiRatelimit(): RateLimiterLike {
  const redis = getRedis();
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: false,
      prefix: "rl:api",
    });
  }
  return inMemoryApiLimiter;
}

/** 2FA : 5 tentatives par minute par IP */
export function get2FARatelimit(): RateLimiterLike {
  const redis = getRedis();
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      analytics: false,
      prefix: "rl:2fa",
    });
  }
  return inMemory2FALimiter;
}

/** Endpoints IA : 5 requêtes par minute par IP (coût API élevé) */
const inMemoryAILimiter = new InMemoryRateLimiter(5, 60_000);
export function getAIRatelimit(): RateLimiterLike {
  const redis = getRedis();
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      analytics: false,
      prefix: "rl:ai",
    });
  }
  return inMemoryAILimiter;
}

/** Portail locataire : 5 tentatives par 5 minutes par email */
export function getPortalRatelimit(): RateLimiterLike {
  const redis = getRedis();
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "300 s"),
      analytics: false,
      prefix: "rl:portal",
    });
  }
  return inMemoryPortalLimiter;
}
