import { describe, it, expect, vi, afterEach } from "vitest";
import { getQontoOrganization, getQontoTransactions, createQontoTransfer } from "./qonto";

afterEach(() => {
  vi.restoreAllMocks();
});

const SLUG = "my-company";
const SECRET = "secret-key";
const ACCOUNT_SLUG = "my-account";

describe("getQontoOrganization", () => {
  it("retourne l'organisation si le fetch réussit (B0 arm1: sans params, B1 arm1: ok)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organization: { id: "ORG1", slug: SLUG, bank_accounts: [] } }),
    });
    const result = await getQontoOrganization(SLUG, SECRET);
    expect(result.id).toBe("ORG1");
    // Vérifie que l'URL ne contient pas de ? (pas de params)
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).not.toContain("?");
  });

  it("lève une erreur si le fetch échoue (B1 arm0: !ok)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, text: () => Promise.resolve("Unauthorized"),
    });
    await expect(getQontoOrganization(SLUG, SECRET)).rejects.toThrow("[qonto]");
  });
});

describe("getQontoTransactions", () => {
  it("récupère toutes les transactions sur une page (B0 arm0: avec params, B2/B3 arm0: sans settledAtFrom, next_page null)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        transactions: [{ id: "T1" }, { id: "T2" }],
        meta: { next_page: null, total_count: 2 },
      }),
    });
    const result = await getQontoTransactions(SLUG, SECRET, ACCOUNT_SLUG);
    expect(result).toHaveLength(2);
    // Vérifie que l'URL contient des params (? present)
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("?");
  });

  it("filtre par settledAtFrom si fourni (B2 arm0)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        transactions: [{ id: "T3" }],
        meta: { next_page: null, total_count: 1 },
      }),
    });
    await getQontoTransactions(SLUG, SECRET, ACCOUNT_SLUG, "2025-01-01T00:00:00Z");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("settled_at_from");
  });

  it("pagine sur plusieurs pages (B3 arm1: next_page non null)", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          transactions: [{ id: "T1" }],
          meta: { next_page: 2, total_count: 2 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          transactions: [{ id: "T2" }],
          meta: { next_page: null, total_count: 2 },
        }),
      });
    const result = await getQontoTransactions(SLUG, SECRET, ACCOUNT_SLUG);
    expect(result).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("createQontoTransfer", () => {
  it("crée un virement et retourne les données (B4 arm1: ok)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ external_transfer: { id: "ET1", status: "pending", amount: 100 } }),
    });
    const result = await createQontoTransfer(SLUG, SECRET, ACCOUNT_SLUG, {
      beneficiary_name: "John Doe",
      beneficiary_iban: "FR76 1234 5678 9012 3456 7890 189",
      amount_cents: 10000,
      currency: "EUR",
    });
    expect(result.id).toBe("ET1");
  });

  it("lève une erreur si le fetch échoue (B4 arm0: !ok)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 422, text: () => Promise.resolve("Unprocessable"),
    });
    await expect(
      createQontoTransfer(SLUG, SECRET, ACCOUNT_SLUG, {
        beneficiary_name: "John Doe",
        beneficiary_iban: "FR7612345678901234567890189",
        amount_cents: 10000,
        currency: "EUR",
      })
    ).rejects.toThrow("[qonto] POST");
  });
});
