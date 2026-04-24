import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCronSecret } from "./cron-auth";

describe("verifyCronSecret", () => {
  const VALID_SECRET = "super-secret-cron-key-12345";

  beforeEach(() => {
    process.env.CRON_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("retourne true si le secret correspond exactement", () => {
    expect(verifyCronSecret(VALID_SECRET)).toBe(true);
  });

  it("retourne true avec le format Bearer token", () => {
    expect(verifyCronSecret(`Bearer ${VALID_SECRET}`)).toBe(true);
  });

  it("retourne false si le secret est incorrect", () => {
    expect(verifyCronSecret("mauvais-secret")).toBe(false);
  });

  it("retourne false si le secret est null", () => {
    expect(verifyCronSecret(null)).toBe(false);
  });

  it("retourne false si le secret est undefined", () => {
    expect(verifyCronSecret(undefined)).toBe(false);
  });

  it("retourne false si le secret est une chaîne vide", () => {
    expect(verifyCronSecret("")).toBe(false);
  });

  it("retourne false si CRON_SECRET n'est pas configuré", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret(VALID_SECRET)).toBe(false);
  });

  it("retourne false si le secret a une longueur différente", () => {
    expect(verifyCronSecret(VALID_SECRET + "x")).toBe(false);
  });

  it("est sensible à la casse", () => {
    expect(verifyCronSecret(VALID_SECRET.toUpperCase())).toBe(false);
  });

  it("strip correctement le préfixe Bearer avant comparaison", () => {
    // S'assurer que "Bearer " lui-même n'est pas ajouté à la comparaison
    expect(verifyCronSecret(`Bearer ${VALID_SECRET}`)).toBe(true);
    expect(verifyCronSecret(`bearer ${VALID_SECRET}`)).toBe(false); // sensible à la casse du préfixe
  });
});
