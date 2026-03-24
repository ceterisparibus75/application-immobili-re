import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
}

/** Login : 3 tentatives par 10 secondes par IP */
export function getLoginRatelimit(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "10 s"),
    analytics: false,
    prefix: "rl:login",
  });
}

/** API generale : 10 requetes par 10 secondes par IP */
export function getApiRatelimit(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    analytics: false,
    prefix: "rl:api",
  });
}
