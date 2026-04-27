import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasValidInternalSecret, isInternalAnalyzeRequest } from "./internal-route-auth";

describe("internal-route-auth", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("valide un secret brut ou Bearer", () => {
    expect(hasValidInternalSecret("cron-secret")).toBe(true);
    expect(hasValidInternalSecret("Bearer cron-secret")).toBe(true);
    expect(hasValidInternalSecret("wrong-secret")).toBe(false);
  });

  it("autorise l'analyse document interne avec x-cron-secret", () => {
    const headers = new Headers({ "x-cron-secret": "cron-secret" });

    expect(isInternalAnalyzeRequest("/api/documents/doc-1/analyze", headers.get.bind(headers))).toBe(true);
  });

  it("autorise l'analyse facture fournisseur interne avec Authorization Bearer", () => {
    const headers = new Headers({ authorization: "Bearer cron-secret" });

    expect(isInternalAnalyzeRequest("/api/supplier-invoices/inv-1/analyze", headers.get.bind(headers))).toBe(true);
  });

  it("refuse les autres routes et les mauvais secrets", () => {
    const headers = new Headers({ "x-cron-secret": "wrong-secret" });

    expect(isInternalAnalyzeRequest("/api/documents/doc-1/analyze", headers.get.bind(headers))).toBe(false);
    expect(isInternalAnalyzeRequest("/api/documents/doc-1/chat", headers.get.bind(headers))).toBe(false);
  });
});
