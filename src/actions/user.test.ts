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

const mockBcryptCompare = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const mockBcryptHash = vi.hoisted(() => vi.fn().mockResolvedValue("hashed-password"));
vi.mock("bcryptjs", () => ({ compare: mockBcryptCompare, hash: mockBcryptHash }));

import {
  assignUserToSociety,
  removeUserFromSociety,
  toggleEmailCopy,
  updateModulePermissions,
  changePassword,
  deleteUser,
  getUsersNotInSociety,
  getUsers,
  getModulePermissions,
  resetModulePermissions,
  getAllManagedUsers,
  resendInvitation,
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

// ── changePassword ────────────────────────────────────────────────

describe("changePassword", () => {
  const validInput = {
    currentPassword: "OldPassword123!",
    newPassword: "NewPassword456!",
    confirmPassword: "NewPassword456!",
  };

  beforeEach(() => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue("new-hashed-password");
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await changePassword(validInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si les mots de passe ne correspondent pas", async () => {
    const result = await changePassword({ ...validInput, confirmPassword: "DifferentPassword999!" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("correspondent pas");
  });

  it("retourne une erreur si le mot de passe actuel est incorrect", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "old-hash",
    } as never);
    mockBcryptCompare.mockResolvedValue(false);

    const result = await changePassword(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("incorrect");
  });

  it("change le mot de passe avec succès", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "old-hash",
    } as never);
    prismaMock.user.update.mockResolvedValue({ id: "user-1" } as never);

    const result = await changePassword(validInput);
    expect(result.success).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { passwordHash: "new-hashed-password" } })
    );
  });
});

// ── deleteUser ────────────────────────────────────────────────────

describe("deleteUser", () => {
  beforeEach(() => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    // Simuler un accès SUPER_ADMIN via userSociety
    prismaMock.userSociety.findMany.mockResolvedValue([
      { userId: "user-1", societyId: SOCIETY_ID, role: "SUPER_ADMIN" },
    ] as never);
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteUser(USER_ID);
    expect(result.success).toBe(false);
  });

  it("bloque la suppression de son propre compte (user-1 = session courante)", async () => {
    // "user-1" est l'ID de la session active dans mockAuthSession
    const result = await deleteUser("user-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("propre compte");
  });

  it("retourne une erreur si l'utilisateur est introuvable", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await deleteUser(USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("supprime l'utilisateur avec succès", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID,
      email: "target@example.com",
    } as never);
    prismaMock.$transaction.mockResolvedValue([]);

    const result = await deleteUser(USER_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});

// ── getUsersNotInSociety ──────────────────────────────────────────

describe("getUsersNotInSociety", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getUsersNotInSociety(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne les utilisateurs non membres de la société", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findMany.mockResolvedValue([
      { userId: "user-1" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: USER_ID, email: "other@example.com", name: "Other User" },
    ] as never);

    const result = await getUsersNotInSociety(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ["user-1"] } }),
      })
    );
  });
});

// ── getUsers ──────────────────────────────────────────────────────

describe("getUsers", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getUsers(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne les membres d'une société donnée", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findMany.mockResolvedValue([
      {
        role: "GESTIONNAIRE",
        user: { id: USER_ID, email: "u@example.com", name: "U", firstName: null, isActive: true, lastLoginAt: null, createdAt: new Date(), emailCopyEnabled: false },
      },
    ] as never);

    const result = await getUsers(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: USER_ID, role: "GESTIONNAIRE" });
  });
});

// ── getModulePermissions ──────────────────────────────────────────

describe("getModulePermissions", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getModulePermissions(USER_ID, SOCIETY_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si l'utilisateur n'est pas membre", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique
      .mockResolvedValueOnce({ userId: "user-1", societyId: SOCIETY_ID, role: "ADMIN_SOCIETE", modulePermissions: null } as never)
      .mockResolvedValueOnce(null as never);
    const r = await getModulePermissions(USER_ID, SOCIETY_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("non membre");
  });

  it("retourne les permissions par défaut si aucune personnalisation", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique
      .mockResolvedValueOnce({ userId: "user-1", societyId: SOCIETY_ID, role: "ADMIN_SOCIETE", modulePermissions: null } as never)
      .mockResolvedValueOnce({ userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE", modulePermissions: null } as never);
    const r = await getModulePermissions(USER_ID, SOCIETY_ID);
    expect(r.success).toBe(true);
    expect(r.data?.role).toBe("GESTIONNAIRE");
    expect(r.data?.isCustom).toBe(false);
  });
});

// ── resetModulePermissions ────────────────────────────────────────

describe("resetModulePermissions", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await resetModulePermissions(USER_ID, SOCIETY_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si l'utilisateur n'est pas membre", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique
      .mockResolvedValueOnce({ userId: "user-1", societyId: SOCIETY_ID, role: "ADMIN_SOCIETE", modulePermissions: null } as never)
      .mockResolvedValueOnce(null as never);
    const r = await resetModulePermissions(USER_ID, SOCIETY_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("non membre");
  });

  it("réinitialise les permissions avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique
      .mockResolvedValueOnce({ userId: "user-1", societyId: SOCIETY_ID, role: "ADMIN_SOCIETE", modulePermissions: null } as never)
      .mockResolvedValueOnce({ userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE", modulePermissions: { locataires: ["read"] } } as never);
    prismaMock.userSociety.update.mockResolvedValue({} as never);
    const r = await resetModulePermissions(USER_ID, SOCIETY_ID);
    expect(r.success).toBe(true);
    expect(prismaMock.userSociety.update).toHaveBeenCalledOnce();
  });
});

// ── getAllManagedUsers ─────────────────────────────────────────────

describe("getAllManagedUsers", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getAllManagedUsers();
    expect(r.success).toBe(false);
  });

  it("retourne une liste vide si aucun propriétaire", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.proprietaire.findMany.mockResolvedValue([] as never);
    const r = await getAllManagedUsers();
    expect(r.success).toBe(true);
    expect(r.data?.users).toHaveLength(0);
    expect(r.data?.societies).toHaveLength(0);
  });
});

// ── resendInvitation ──────────────────────────────────────────────

describe("resendInvitation", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await resendInvitation(USER_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si pas de droits admin", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.userSociety.findFirst.mockResolvedValue(null as never);
    const r = await resendInvitation(USER_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("insuffisants");
  });

  it("erreur si utilisateur introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findFirst.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.user.findUnique.mockResolvedValue(null as never);
    const r = await resendInvitation(USER_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("introuvable");
  });

  it("erreur si l'utilisateur a déjà activé son compte", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findFirst.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID, email: "u@example.com", name: "U", firstName: null,
      lastLoginAt: new Date(),
    } as never);
    const r = await resendInvitation(USER_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("activé son compte");
  });
});
