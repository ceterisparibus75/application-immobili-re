import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

const { revalidatePath, randomUUID, hash } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  randomUUID: vi.fn()
    .mockReturnValueOnce("uuid-seed-1234")
    .mockReturnValueOnce("uuid-secret-5678")
    .mockReturnValue("uuid-generic"),
  hash: vi.fn().mockResolvedValue("hashed-secret"),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("crypto", () => ({ randomUUID }));
vi.mock("bcryptjs", () => ({
  default: { hash },
}));

import {
  getSupplierInboxConfig,
  regenerateInboxSecret,
  upsertSupplierInboxConfig,
} from "./supplier-inbox";

const SOCIETY_ID = "cm8m6m6m6000008l2a1bcdefg";

describe("supplier-inbox actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUID
      .mockReset()
      .mockReturnValueOnce("uuid-seed-1234")
      .mockReturnValueOnce("uuid-secret-5678")
      .mockReturnValue("uuid-generic");
    hash.mockResolvedValue("hashed-secret");
  });

  it("retourne une erreur de validation si un email est invalide", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);

    const result = await upsertSupplierInboxConfig(SOCIETY_ID, {
      notifyEmails: ["invalid-email"],
      isActive: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Email invalide");
  });

  it("crée une config inbox si aucune n'existe", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.supplierInboxConfig.findUnique.mockResolvedValue(null);
    prismaMock.supplierInboxConfig.create.mockResolvedValue({
      id: "inbox-1",
      inboxEmail: "factures-1bcdefg-uuid@inbox.mygestia.immo",
    } as never);

    const result = await upsertSupplierInboxConfig(SOCIETY_ID, {
      notifyEmails: ["finance@example.com"],
      isActive: true,
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: "inbox-1",
        inboxEmail: "factures-1bcdefg-uuid@inbox.mygestia.immo",
      },
    });
    expect(prismaMock.supplierInboxConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: SOCIETY_ID,
        inboxSlug: expect.stringMatching(/^[a-z0-9]{8}-uuid$/),
        inboxEmail: expect.stringMatching(/^factures-[a-z0-9]{8}-uuid@inbox\.mygestia\.immo$/),
        webhookSecretHash: "hashed-secret",
        notifyEmails: ["finance@example.com"],
        isActive: true,
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/parametres/facturation");
  });

  it("retourne null en lecture silencieuse si non authentifié", async () => {
    mockUnauthenticated();

    const result = await getSupplierInboxConfig(SOCIETY_ID);

    expect(result).toBeNull();
  });

  it("régénère le secret webhook si la config existe", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.supplierInboxConfig.findUnique.mockResolvedValue({ id: "inbox-1" } as never);

    const result = await regenerateInboxSecret(SOCIETY_ID);

    expect(result).toEqual({
      success: true,
      data: { rawSecret: "uuid-seed-1234" },
    });
    expect(prismaMock.supplierInboxConfig.update).toHaveBeenCalledWith({
      where: { societyId: SOCIETY_ID },
      data: { webhookSecretHash: "hashed-secret" },
    });
  });
});
