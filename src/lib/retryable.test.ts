import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retryable";

// baseDelayMs: 1, maxDelayMs: 1 → délais d'1ms max, pas besoin de fausse horloge
const FAST = { retries: 2, baseDelayMs: 1, maxDelayMs: 1 };

describe("withRetry", () => {
  it("retourne le résultat immédiatement si la fonction réussit du premier coup", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withRetry(fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("réessaie jusqu'à succès et retourne la valeur", async () => {
    const err = new Error("econnreset");
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue("retried-ok");

    expect(await withRetry(fn, { ...FAST, retries: 3 })).toBe("retried-ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("lance l'erreur après avoir épuisé tous les retries", async () => {
    const err = new Error("socket hang up");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, FAST)).rejects.toThrow("socket hang up");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("ne réessaie pas si l'erreur n'est pas retryable", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ValidationError: champ requis"));
    await expect(withRetry(fn, FAST)).rejects.toThrow("ValidationError");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("utilise shouldRetry personnalisé", async () => {
    const err = new Error("custom error");
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("done");
    const shouldRetry = vi.fn().mockReturnValue(true);

    expect(await withRetry(fn, { ...FAST, shouldRetry })).toBe("done");
    expect(shouldRetry).toHaveBeenCalledWith(err);
  });

  it("ne réessaie pas si shouldRetry retourne false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));
    await expect(withRetry(fn, { ...FAST, shouldRetry: () => false })).rejects.toThrow("non-retryable");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  describe("erreurs réseau retryables", () => {
    it.each([
      ["ECONNRESET", "econnreset"],
      ["ENOTFOUND", "enotfound"],
      ["ETIMEDOUT", "etimedout"],
      ["socket", "socket closed"],
    ])("réessaie sur erreur réseau %s", async (_name, msg) => {
      const fn = vi.fn().mockRejectedValueOnce(new Error(msg)).mockResolvedValue("ok");
      expect(await withRetry(fn, FAST)).toBe("ok");
    });
  });

  describe("codes HTTP retryables", () => {
    it.each([429, 500, 502, 503, 504])("réessaie sur statut HTTP %d", async (status) => {
      const err = Object.assign(new Error(`HTTP ${status}`), { status });
      const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
      expect(await withRetry(fn, FAST)).toBe("ok");
    });

    it("réessaie avec statusCode (variante alternative au champ status)", async () => {
      const err = Object.assign(new Error("rate limit"), { statusCode: 429 });
      const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
      expect(await withRetry(fn, FAST)).toBe("ok");
    });
  });

  it("ne réessaie pas sur un objet non-Error (string throwé)", async () => {
    const fn = vi.fn().mockRejectedValue("raw string error");
    await expect(withRetry(fn, FAST)).rejects.toBe("raw string error");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
