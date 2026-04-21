import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

const {
  revalidatePath,
  createAuditLog,
  encrypt,
  initPowensUser,
  getPowensWebviewCode,
  buildPowensWebviewUrl,
  getPowensConnectors,
  getQontoOrganization,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  encrypt: vi.fn((value: string) => `enc:${value}`),
  initPowensUser: vi.fn(),
  getPowensWebviewCode: vi.fn(),
  buildPowensWebviewUrl: vi.fn(),
  getPowensConnectors: vi.fn(),
  getQontoOrganization: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog }));
vi.mock("@/lib/encryption", () => ({
  encrypt,
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
}));
vi.mock("@/lib/powens", () => ({
  initPowensUser,
  getPowensWebviewCode,
  buildPowensWebviewUrl,
  getPowensUserAccounts: vi.fn(),
  getPowensTransactions: vi.fn(),
  getPowensConnectors,
}));
vi.mock("@/lib/qonto", () => ({
  getQontoOrganization,
  getQontoTransactions: vi.fn(),
}));
vi.mock("@/actions/cashflow", () => ({
  applyAutoTag: vi.fn(),
}));

import {
  connectQonto,
  deleteBankConnection,
  getGocardlessInstitutions,
  initiateOpenBanking,
} from "./bank-connection";

describe("bank connection actions", () => {
  const previousAuthUrl = process.env.AUTH_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_URL = "https://app.test";
  });

  afterAll(() => {
    process.env.AUTH_URL = previousAuthUrl;
  });

  it("retourne une erreur si non authentifié pour la liste des institutions", async () => {
    mockUnauthenticated();

    const result = await getGocardlessInstitutions("society-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne la liste des connecteurs Powens", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    getPowensConnectors.mockResolvedValue([{ id: 1, name: "Qonto" }]);

    const result = await getGocardlessInstitutions("society-1");

    expect(result).toEqual({ success: true, data: [{ id: 1, name: "Qonto" }] });
  });

  it("initie une connexion open banking et retourne le lien webview", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    initPowensUser.mockResolvedValue({ auth_token: "powens-token", id_user: 42 });
    getPowensWebviewCode.mockResolvedValue("webview-code");
    buildPowensWebviewUrl.mockReturnValue("https://powens.test/webview");
    prismaMock.bankConnection.create.mockResolvedValue({ id: "connection-1" } as never);

    const result = await initiateOpenBanking("society-1", "12", "BNP");

    expect(result).toEqual({
      success: true,
      data: {
        authLink: "https://powens.test/webview",
        connectionId: "connection-1",
      },
    });
    expect(prismaMock.bankConnection.create).toHaveBeenCalledWith({
      data: {
        societyId: "society-1",
        powensUserId: "42",
        connectorId: "12",
        institutionName: "BNP",
        status: "pending",
        powensAccessToken: "enc:powens-token",
      },
    });
    expect(buildPowensWebviewUrl).toHaveBeenCalledWith({
      code: "webview-code",
      state: "connection-1",
      redirectUri: "https://app.test/api/banque/callback",
      connectorId: 12,
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "BankConnection",
        entityId: "connection-1",
      })
    );
  });

  it("mappe les erreurs 401 Qonto sur un message métier", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    getQontoOrganization.mockRejectedValue(new Error("401 Unauthorized"));

    const result = await connectQonto("society-1", "my-slug", "secret-key");

    expect(result).toEqual({
      success: false,
      error: "Identifiants Qonto invalides. Vérifiez le slug et la clé secrète.",
    });
  });

  it("expire une connexion bancaire et détache ses comptes", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankConnection.findFirst.mockResolvedValue({
      id: "connection-1",
      institutionName: "BNP",
    } as never);

    const result = await deleteBankConnection("society-1", "connection-1");

    expect(result).toEqual({ success: true });
    expect(prismaMock.bankConnection.update).toHaveBeenCalledWith({
      where: { id: "connection-1" },
      data: { status: "expired" },
    });
    expect(prismaMock.bankAccount.updateMany).toHaveBeenCalledWith({
      where: { connectionId: "connection-1" },
      data: { connectionId: null, powensAccountId: null },
    });
  });
});
