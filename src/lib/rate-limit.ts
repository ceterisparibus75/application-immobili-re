import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

/** Login : 3 tentatives par 10 secondes par IP */
export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "10 s"),
  analytics: false,
  prefix: "rl:login",
});

/** API générale : 10 requêtes par 10 secondes par IP */
export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: false,
  prefix: "rl:api",
});
