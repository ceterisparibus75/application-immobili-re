import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { decrypt } = vi.hoisted(() => ({ decrypt: vi.fn((v: string) => `decrypted:${v}`) }));
const { syncAccountTransactionsInternal, syncQontoTransactionsInternal } = vi.hoisted(() => ({
  syncAccountTransactionsInternal: vi.fn(),
  syncQontoTransactionsInternal: vi.fn(),
}));

vi.mock("@/lib/encryption", () => ({ decrypt }));
vi.mock("@/actions/bank-connection", () => ({
  syncAccountTransactionsInternal,
  syncQontoTransactionsInternal,
}));
vi.mock("@/lib/env", () => ({ env: process.env }));

import { GET } from "./route";

const POWENS_ACCOUNT = {
  id: "acc-powens-1",
  societyId: "soc-1",
  powensAccountId: "12345",
  isActive: true,
  connection: {
    powensUserId: "999",
    powensAccessToken: "enc-token",
    status: "active",
  },
};

const QONTO_ACCOUNT = {
  id: "acc-qonto-1",
  societyId: "soc-1",
  qontoAccountId: "qonto-acc-xyz",
  isActive: true,
  connection: {
    provider: "QONTO",
    qontoSlugEncrypted: "enc-slug",
    qontoSecretKeyEncrypted: "enc-key",
    status: "active",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  prismaMock.bankAccount.findMany.mockResolvedValue([]);
  syncAccountTransactionsInternal.mockResolvedValue(0);
  syncQontoTransactionsInternal.mockResolvedValue(0);
});

describe("GET /api/cron/sync-bank", () => {
  it("retourne 401 si CRON_SECRET non configuré ou header manquant", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/sync-bank") as never);
    expect(response.status).toBe(401);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization incorrect", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/sync-bank", {
        headers: { Authorization: "Bearer wrong" },
      }) as never
    );
    expect(response.status).toBe(401);
  });

  it("retourne 200 sans comptes à synchroniser", async () => {
    // findMany called twice (Powens + Qonto), both return []
    prismaMock.bankAccount.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await GET(
      new Request("http://localhost/api/cron/sync-bank", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, accountsSynced: 0, transactionsImported: 0 });
  });

  it("synchronise un compte Powens et compte les transactions importées", async () => {
    prismaMock.bankAccount.findMany
      .mockResolvedValueOnce([POWENS_ACCOUNT] as never)
      .mockResolvedValueOnce([]);
    syncAccountTransactionsInternal.mockResolvedValue(12);

    const response = await GET(
      new Request("http://localhost/api/cron/sync-bank", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body).toEqual({ success: true, accountsSynced: 1, transactionsImported: 12 });
    expect(decrypt).toHaveBeenCalledWith("enc-token");
    expect(syncAccountTransactionsInternal).toHaveBeenCalledWith(
      "soc-1", "acc-powens-1", 12345, 999, "decrypted:enc-token"
    );
  });

  it("synchronise un compte Qonto", async () => {
    prismaMock.bankAccount.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([QONTO_ACCOUNT] as never);
    syncQontoTransactionsInternal.mockResolvedValue(7);

    const response = await GET(
      new Request("http://localhost/api/cron/sync-bank", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.accountsSynced).toBe(1);
    expect(body.transactionsImported).toBe(7);
    expect(syncQontoTransactionsInternal).toHaveBeenCalledWith(
      "soc-1", "acc-qonto-1", "qonto-acc-xyz",
      "decrypted:enc-slug", "decrypted:enc-key"
    );
  });

  it("enregistre une erreur Powens sans interrompre la suite", async () => {
    prismaMock.bankAccount.findMany
      .mockResolvedValueOnce([POWENS_ACCOUNT] as never)
      .mockResolvedValueOnce([]);
    syncAccountTransactionsInternal.mockRejectedValue(new Error("Powens timeout"));

    const response = await GET(
      new Request("http://localhost/api/cron/sync-bank", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.accountsSynced).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("Powens");
  });

  it("saute un compte Powens dont la connexion est inactive", async () => {
    const inactive = { ...POWENS_ACCOUNT, connection: { ...POWENS_ACCOUNT.connection, status: "error" } };
    prismaMock.bankAccount.findMany
      .mockResolvedValueOnce([inactive] as never)
      .mockResolvedValueOnce([]);

    await GET(
      new Request("http://localhost/api/cron/sync-bank", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(syncAccountTransactionsInternal).not.toHaveBeenCalled();
  });
});
