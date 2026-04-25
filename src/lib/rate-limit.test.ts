import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  RedisCtor: vi.fn(),
  RatelimitCtor: vi.fn(),
  slidingWindow: vi.fn().mockReturnValue("sliding-window"),
}));

vi.mock("@upstash/redis", () => ({
  Redis: function MockRedis(opts: unknown) { mocks.RedisCtor(opts); return {}; },
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    function MockRatelimit(opts: unknown) { mocks.RatelimitCtor(opts); return { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 10000 }) }; },
    { slidingWindow: mocks.slidingWindow }
  ),
}));

import { getLoginRatelimit, getApiRatelimit, get2FARatelimit, getPortalRatelimit, getAIRatelimit } from "./rate-limit";

// Redis n'est pas configuré en test → tous les limiters sont InMemoryRateLimiter

describe("InMemoryRateLimiter (via getLoginRatelimit)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("autorise les premières requêtes sous la limite", async () => {
    const limiter = getLoginRatelimit(); // 3 req / 10s
    const key = `test-login-${Date.now()}`;
    const r1 = await limiter.limit(key);
    const r2 = await limiter.limit(key);
    const r3 = await limiter.limit(key);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
  });

  it("bloque la 4ème requête pour la même clé (login : 3/10s)", async () => {
    const limiter = getLoginRatelimit();
    const key = `test-login-block-${Date.now()}`;
    await limiter.limit(key);
    await limiter.limit(key);
    await limiter.limit(key);
    const r4 = await limiter.limit(key);
    expect(r4.success).toBe(false);
  });

  it("réinitialise la fenêtre après expiration", async () => {
    const limiter = getLoginRatelimit();
    const key = `test-login-reset-${Date.now()}`;
    await limiter.limit(key);
    await limiter.limit(key);
    await limiter.limit(key);
    // Avancer le temps au-delà de la fenêtre de 10s
    vi.advanceTimersByTime(11_000);
    const r = await limiter.limit(key);
    expect(r.success).toBe(true);
  });

  it("clés différentes n'interfèrent pas entre elles", async () => {
    const limiter = getLoginRatelimit();
    const key1 = `ip-1-${Date.now()}`;
    const key2 = `ip-2-${Date.now()}`;
    await limiter.limit(key1);
    await limiter.limit(key1);
    await limiter.limit(key1);
    const r4key1 = await limiter.limit(key1);
    expect(r4key1.success).toBe(false);
    const r1key2 = await limiter.limit(key2);
    expect(r1key2.success).toBe(true);
  });

  it("retourne un timestamp reset positif", async () => {
    const limiter = getLoginRatelimit();
    const key = `test-reset-ts-${Date.now()}`;
    const result = await limiter.limit(key);
    expect(result.reset).toBeGreaterThan(Date.now());
  });
});

describe("get2FARatelimit — 5 req / 60s", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("autorise 5 requêtes puis bloque la 6ème", async () => {
    const limiter = get2FARatelimit();
    const key = `2fa-${Date.now()}`;
    for (let i = 0; i < 5; i++) await limiter.limit(key);
    const r6 = await limiter.limit(key);
    expect(r6.success).toBe(false);
  });
});

describe("getApiRatelimit — 10 req / 10s", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("autorise 10 requêtes puis bloque la 11ème", async () => {
    const limiter = getApiRatelimit();
    const key = `api-${Date.now()}`;
    for (let i = 0; i < 10; i++) await limiter.limit(key);
    const r11 = await limiter.limit(key);
    expect(r11.success).toBe(false);
  });
});

describe("getPortalRatelimit — 5 req / 300s", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("autorise 5 requêtes puis bloque", async () => {
    const limiter = getPortalRatelimit();
    const key = `portal-${Date.now()}`;
    for (let i = 0; i < 5; i++) await limiter.limit(key);
    const r6 = await limiter.limit(key);
    expect(r6.success).toBe(false);
  });

  it("réinitialise après 300s", async () => {
    const limiter = getPortalRatelimit();
    const key = `portal-reset-${Date.now()}`;
    for (let i = 0; i < 5; i++) await limiter.limit(key);
    vi.advanceTimersByTime(301_000);
    const r = await limiter.limit(key);
    expect(r.success).toBe(true);
  });
});

describe("getAIRatelimit — 5 req / 60s", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("autorise 5 requêtes puis bloque la 6ème", async () => {
    const limiter = getAIRatelimit();
    const key = `ai-${Date.now()}`;
    for (let i = 0; i < 5; i++) await limiter.limit(key);
    const r6 = await limiter.limit(key);
    expect(r6.success).toBe(false);
  });
});

describe("rate-limit — branche Redis (credentials configurés)", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("crée les limiters Redis si UPSTASH_REDIS_REST_URL et TOKEN sont définis (lignes 10, 58, 72, 86, 101, 115)", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    vi.resetModules();

    const mod = await import("./rate-limit");

    const loginLimiter = mod.getLoginRatelimit();
    const apiLimiter = mod.getApiRatelimit();
    const faLimiter = mod.get2FARatelimit();
    const aiLimiter = mod.getAIRatelimit();
    const portalLimiter = mod.getPortalRatelimit();

    expect(loginLimiter).toBeDefined();
    expect(apiLimiter).toBeDefined();
    expect(faLimiter).toBeDefined();
    expect(aiLimiter).toBeDefined();
    expect(portalLimiter).toBeDefined();
  });

  it("retourne le Redis en cache lors du second appel (ligne 15)", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    vi.resetModules();

    mocks.RedisCtor.mockClear();
    const mod = await import("./rate-limit");

    mod.getLoginRatelimit(); // crée _redis (ligne 10)
    mod.getApiRatelimit();   // réutilise _redis (ligne 15)

    expect(mocks.RedisCtor).toHaveBeenCalledTimes(1);
  });
});
