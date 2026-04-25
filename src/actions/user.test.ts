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
  sendNewUserInviteEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/env", () => ({
  env: { AUTH_URL: "https://app.test" },
}));

const mockBcryptCompare = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const mockBcryptHash = vi.hoisted(() => vi.fn().mockResolvedValue("hashed-password"));
vi.mock("bcryptjs", () => ({ compare: mockBcryptCompare, hash: mockBcryptHash }));

const mockRandomBytes = vi.hoisted(() => vi.fn().mockReturnValue({ toString: () => "random-token" }));
vi.mock("crypto", () => ({ randomBytes: mockRandomBytes }));

import {
  assignUserToSociety,
  removeUserFromSociety,
  toggleEmailCopy,
  updateModulePermissions,
  changePassword,
  createUser,
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

  it("retourne Accès refusé si l'utilisateur n'est pas membre de la société", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null);

    const result = await toggleEmailCopy(USER_ID, SOCIETY_ID, true);
    expect(result).toEqual({ success: false, error: "Accès refusé" });
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

  it("toggleEmailCopy retourne une erreur generique si la BDD echoue (lignes 813-814)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockRejectedValue(new Error("DB crash"));
    const result = await toggleEmailCopy(USER_ID, SOCIETY_ID, true);
    expect(result.success).toBe(false);
    expect(result.error).toContain("modification");
  });

  it("assignUserToSociety retourne une erreur si abonnement inactif (ligne 220)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    checkSubscriptionActive.mockResolvedValueOnce({ active: false, message: "Abonnement expiré" });
    const result = await assignUserToSociety({ userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Abonnement");
  });

  it("assignUserToSociety retourne une erreur si quota utilisateurs dépassé (ligne 222)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    checkUserLimit.mockResolvedValueOnce({ allowed: false, message: "Quota atteint" });
    const result = await assignUserToSociety({ userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Quota");
  });

  it("assignUserToSociety retourne une erreur si input Zod invalide (lignes 207-209)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    const result = await assignUserToSociety({ userId: "not-a-cuid", societyId: SOCIETY_ID, role: "GESTIONNAIRE" });
    expect(result.success).toBe(false);
  });

  it("assignUserToSociety retourne une erreur ForbiddenError (ligne 253-254)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await assignUserToSociety({ userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE" });
    expect(result.success).toBe(false);
  });

  it("assignUserToSociety retourne une erreur generique si la BDD echoue (lignes 256-257)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.upsert.mockRejectedValue(new Error("DB crash"));
    const result = await assignUserToSociety({ userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("assignation");
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

  it("retourne une erreur si l'utilisateur est introuvable (ligne 371)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null as never);
    const result = await changePassword(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne une erreur generique si la BDD echoue (lignes 390-391)", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB crash"));
    const result = await changePassword(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("mot de passe");
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

  it("retourne une erreur ForbiddenError si non SUPER_ADMIN (lignes 341-342)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.userSociety.findMany.mockResolvedValue([
      { userId: "user-1", societyId: SOCIETY_ID, role: "GESTIONNAIRE" },
    ] as never);
    const result = await deleteUser(USER_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (lignes 344-345)", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB crash"));
    const result = await deleteUser(USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("suppression");
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

  it("retourne tous les utilisateurs en mode SUPER_ADMIN sans societyId (lignes 453-455)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findMany.mockResolvedValue([
      { userId: "user-1", societyId: SOCIETY_ID, role: "SUPER_ADMIN" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: USER_ID, email: "u@example.com", name: "U", firstName: null, isActive: true, lastLoginAt: null, createdAt: new Date() },
    ] as never);
    const result = await getUsers();
    expect(Array.isArray(result)).toBe(true);
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

  it("retourne une erreur ForbiddenError (lignes 508-509)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const r = await getModulePermissions(USER_ID, SOCIETY_ID);
    expect(r.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (lignes 511-512)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockRejectedValue(new Error("DB crash"));
    const r = await getModulePermissions(USER_ID, SOCIETY_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("permissions");
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

  it("renvoie l'invitation avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findFirst.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID, email: "u@example.com", name: "U", firstName: null, lastLoginAt: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({ id: USER_ID } as never);

    const r = await resendInvitation(USER_ID);

    expect(r).toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } })
    );
  });

  it("retourne une erreur generique si la BDD echoue dans resendInvitation (lignes 196-197)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findFirst.mockRejectedValue(new Error("DB crash"));
    const r = await resendInvitation(USER_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("invitation");
  });
});

// ── createUser ────────────────────────────────────────────────────

describe("createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    mockBcryptHash.mockResolvedValue("hashed-pwd");
    mockRandomBytes.mockReturnValue({ toString: () => "random-token" });
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await createUser({ name: "Alice", email: "alice@example.com" });
    expect(r.success).toBe(false);
  });

  it("retourne une erreur si droits insuffisants", async () => {
    prismaMock.userSociety.findFirst.mockResolvedValue(null as never);
    const r = await createUser({ name: "Alice", email: "alice@example.com" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("insuffisants");
  });

  it("retourne une erreur de validation si l'email est invalide", async () => {
    prismaMock.userSociety.findFirst.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    const r = await createUser({ name: "Alice", email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("renvoie l'invitation si l'email existe mais sans lastLoginAt", async () => {
    prismaMock.userSociety.findFirst.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID, email: "alice@example.com", lastLoginAt: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({ id: USER_ID } as never);

    const r = await createUser({ name: "Alice", email: "alice@example.com" });

    expect(r).toEqual({ success: true, data: { id: USER_ID } });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } })
    );
  });

  it("retourne une erreur si l'email est déjà actif", async () => {
    prismaMock.userSociety.findFirst.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID, email: "alice@example.com", lastLoginAt: new Date(),
    } as never);

    const r = await createUser({ name: "Alice", email: "alice@example.com" });

    expect(r.success).toBe(false);
    expect(r.error).toContain("déjà utilisé");
  });

  it("crée un nouvel utilisateur et envoie l'email d'invitation", async () => {
    prismaMock.userSociety.findFirst.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.user.findUnique.mockResolvedValue(null as never);
    prismaMock.user.create.mockResolvedValue({
      id: USER_ID, email: "alice@example.com", name: "Alice",
    } as never);

    const r = await createUser({ name: "Alice", email: "alice@example.com" });

    expect(r).toEqual({ success: true, data: { id: USER_ID } });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "alice@example.com", name: "Alice" }),
      })
    );
  });

  it("retourne une erreur generique si la BDD echoue dans createUser (lignes 135-136)", async () => {
    prismaMock.userSociety.findFirst.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB crash"));
    const r = await createUser({ name: "Alice", email: "alice@example.com" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("utilisateur");
  });
});

// ── removeUserFromSociety success ────────────────────────────────

describe("removeUserFromSociety", () => {
  it("retire un autre utilisateur avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);

    const result = await removeUserFromSociety(USER_ID, SOCIETY_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.userSociety.delete).toHaveBeenCalledWith({
      where: { userId_societyId: { userId: USER_ID, societyId: SOCIETY_ID } },
    });
  });

  it("retourne une erreur ForbiddenError (lignes 295-296)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await removeUserFromSociety(USER_ID, SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (lignes 298-299)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.delete.mockRejectedValue(new Error("DB crash"));
    const result = await removeUserFromSociety(USER_ID, SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("retrait");
  });
});

// ── updateModulePermissions success ─────────────────────────────

describe("updateModulePermissions success", () => {
  it("met à jour les permissions avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique
      .mockResolvedValueOnce({ userId: "user-1", societyId: SOCIETY_ID, role: "ADMIN_SOCIETE", modulePermissions: null } as never)
      .mockResolvedValueOnce({ userId: USER_ID, societyId: SOCIETY_ID, role: "GESTIONNAIRE", modulePermissions: null } as never);
    prismaMock.userSociety.update.mockResolvedValue({} as never);

    const result = await updateModulePermissions({
      userId: USER_ID,
      societyId: SOCIETY_ID,
      modulePermissions: { locataires: ["read", "write"] },
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.userSociety.update).toHaveBeenCalledWith({
      where: { userId_societyId: { userId: USER_ID, societyId: SOCIETY_ID } },
      data: { modulePermissions: { locataires: ["read", "write"] } },
    });
  });

  it("retourne une erreur Zod si input invalide (lignes 527-529)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    const result = await updateModulePermissions({ userId: "not-a-cuid", societyId: SOCIETY_ID, modulePermissions: {} });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si l'utilisateur n'est pas membre (ligne 543)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique
      .mockResolvedValueOnce({ userId: "user-1", societyId: SOCIETY_ID, role: "ADMIN_SOCIETE", modulePermissions: null } as never)
      .mockResolvedValueOnce(null as never);
    const result = await updateModulePermissions({ userId: USER_ID, societyId: SOCIETY_ID, modulePermissions: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("non membre");
  });

  it("retourne une erreur ForbiddenError (lignes 582-583)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await updateModulePermissions({ userId: USER_ID, societyId: SOCIETY_ID, modulePermissions: {} });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (lignes 585-586)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockRejectedValue(new Error("DB crash"));
    const result = await updateModulePermissions({ userId: USER_ID, societyId: SOCIETY_ID, modulePermissions: {} });
    expect(result.success).toBe(false);
    expect(result.error).toContain("permissions");
  });
});

// ── getAllManagedUsers with data ──────────────────────────────────

describe("getAllManagedUsers with data", () => {
  it("retourne les utilisateurs avec leurs accès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.proprietaire.findMany.mockResolvedValue([
      {
        id: "prop-1",
        label: "SCI Test",
        societies: [
          {
            id: SOCIETY_ID,
            name: "Ma Société",
            userSocieties: [
              {
                role: "GESTIONNAIRE",
                user: {
                  id: USER_ID,
                  email: "u@example.com",
                  name: "Bob",
                  firstName: null,
                  isActive: true,
                  lastLoginAt: null,
                  emailCopyEnabled: false,
                },
              },
            ],
          },
        ],
      },
    ] as never);

    const r = await getAllManagedUsers();

    expect(r.success).toBe(true);
    expect(r.data?.users).toHaveLength(1);
    expect(r.data?.users[0]).toMatchObject({ id: USER_ID, email: "u@example.com" });
    expect(r.data?.societies).toHaveLength(1);
    expect(r.data?.users[0].accesses).toHaveLength(1);
  });
  it("retourne une erreur generique si la BDD echoue (lignes 757-758)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.proprietaire.findMany.mockRejectedValue(new Error("DB crash"));
    const r = await getAllManagedUsers();
    expect(r.success).toBe(false);
    expect(r.error).toContain("cupération");
  });

  it("trie les utilisateurs par nom avec 2 utilisateurs (ligne 747)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.proprietaire.findMany.mockResolvedValue([
      {
        id: "prop-1", label: "SCI Test",
        societies: [{
          id: SOCIETY_ID, name: "Ma Société",
          userSocieties: [
            { role: "GESTIONNAIRE", user: { id: "u2", email: "z@example.com", name: "Zara", firstName: null, isActive: true, lastLoginAt: null, emailCopyEnabled: false } },
            { role: "GESTIONNAIRE", user: { id: USER_ID, email: "a@example.com", name: "Alice", firstName: null, isActive: true, lastLoginAt: null, emailCopyEnabled: false } },
          ],
        }],
      },
    ] as never);
    const r = await getAllManagedUsers();
    expect(r.success).toBe(true);
    expect(r.data?.users[0].name).toBe("Alice");
  });

});
