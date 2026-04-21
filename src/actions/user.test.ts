import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";
import { auth } from "@/lib/auth";

const { revalidatePath, checkSubscriptionActive, checkUserLimit } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  checkSubscriptionActive: vi.fn(),
  checkUserLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/plan-limits", () => ({
  checkSubscriptionActive,
  checkUserLimit,
}));
vi.mock("@/lib/email", () => ({
  sendNewUserInviteEmail: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: { AUTH_URL: "https://app.test" },
}));

import {
  assignUserToSociety,
  removeUserFromSociety,
  toggleEmailCopy,
  updateModulePermissions,
} from "./user";

const SOCIETY_ID = "cm8m6m6m6000008l2a1bcdefg";
const USER_ID = "cm8m6m6m6000008l2a1bcdefh";

describe("user admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSubscriptionActive.mockResolvedValue({ active: true });
    checkUserLimit.mockResolvedValue({ allowed: true });
  });

  it("retourne une erreur si non authentifié pour assigner un utilisateur", async () => {
    mockUnauthenticated();

    const result = await assignUserToSociety({
      userId: USER_ID,
      societyId: SOCIETY_ID,
      role: "GESTIONNAIRE",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("assigne un utilisateur à une société si abonnement et quota sont valides", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);

    const result = await assignUserToSociety({
      userId: USER_ID,
      societyId: SOCIETY_ID,
      role: "GESTIONNAIRE",
    });

    expect(result).toEqual({ success: true });
    expect(checkSubscriptionActive).toHaveBeenCalledWith(SOCIETY_ID);
    expect(checkUserLimit).toHaveBeenCalledWith(SOCIETY_ID);
    expect(prismaMock.userSociety.upsert).toHaveBeenCalledWith({
      where: {
        userId_societyId: { userId: USER_ID, societyId: SOCIETY_ID },
      },
      create: { userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE" },
      update: { role: "GESTIONNAIRE" },
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "UserSociety",
        entityId: `${USER_ID}-${SOCIETY_ID}`,
      })
    );
  });

  it("empêche de se retirer soi-même d'une société", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);

    const result = await removeUserFromSociety("user-1", SOCIETY_ID);

    expect(result).toEqual({
      success: false,
      error: "Vous ne pouvez pas vous retirer vous-même",
    });
    expect(prismaMock.userSociety.delete).not.toHaveBeenCalled();
  });

  it("empêche de modifier ses propres permissions module", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValue({
      user: { id: USER_ID, email: "admin@example.com", name: "Admin" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });
    prismaMock.userSociety.findUnique.mockResolvedValue({
      userId: USER_ID,
      societyId: SOCIETY_ID,
      role: "ADMIN_SOCIETE",
      modulePermissions: null,
    } as never);

    const result = await updateModulePermissions({
      userId: USER_ID,
      societyId: SOCIETY_ID,
      modulePermissions: {
        rapports: ["read"],
      },
    });

    expect(result).toEqual({
      success: false,
      error: "Vous ne pouvez pas modifier vos propres permissions",
    });
  });

  it("empêche un non-admin de modifier la copie email d'un autre utilisateur", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue({
      userId: "user-1",
      societyId: SOCIETY_ID,
      role: "GESTIONNAIRE",
    } as never);

    const result = await toggleEmailCopy(USER_ID, SOCIETY_ID, true);

    expect(result).toEqual({
      success: false,
      error: "Vous ne pouvez modifier cette option que pour votre propre compte",
    });
  });

  it("permet à un admin de modifier la copie email d'un autre utilisateur", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue({
      userId: "user-1",
      societyId: SOCIETY_ID,
      role: "ADMIN_SOCIETE",
    } as never);

    const result = await toggleEmailCopy(USER_ID, SOCIETY_ID, true);

    expect(result).toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { emailCopyEnabled: true },
    });
  });
});
