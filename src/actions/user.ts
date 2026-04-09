"use server";

import { auth } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, requireSuperAdmin, ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive, checkUserLimit } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";
import {
  createUserSchema,
  updateUserSchema,
  assignUserToSocietySchema,
  changePasswordSchema,
  updateModulePermissionsSchema,
  type CreateUserInput,
  type AssignUserToSocietyInput,
  type UpdateModulePermissionsInput,
} from "@/validations/user";
import type { ModulePermissions } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { sendNewUserInviteEmail } from "@/lib/email";
import type { ActionResult } from "./society";

export async function createUser(
  input: CreateUserInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    // Vérifier que l'email n'est pas déjà utilisé
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      return { success: false, error: "Cet email est déjà utilisé" };
    }

    // Générer un mot de passe aléatoire (l'utilisateur le changera via le lien email)
    const tempPassword = randomBytes(16).toString("base64url");
    const passwordHash = await hash(tempPassword, 12);

    // Générer un token de réinitialisation (valide 72h pour laisser le temps au nouvel utilisateur)
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        firstName: data.firstName || null,
        passwordHash,
        resetToken,
        resetTokenExpiresAt,
      },
    });

    revalidatePath("/administration/utilisateurs");

    // Envoi de l'email d'invitation avec lien de création de mot de passe
    const baseUrl = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    await sendNewUserInviteEmail({
      to: user.email,
      name: `${data.name}${data.firstName ? " " + data.firstName : ""}`,
      email: user.email,
      resetUrl,
      appUrl: baseUrl,
    }).catch((err) => console.error("[createUser] email error", err));

    return { success: true, data: { id: user.id } };
  } catch (error) {
    console.error("[createUser]", error);
    return { success: false, error: "Erreur lors de la création de l'utilisateur" };
  }
}

// ── Renvoyer l'invitation à un utilisateur ─────────────────────────────────

export async function resendInvitation(
  userId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    // Seul un admin peut renvoyer une invitation
    const callerAccess = await prisma.userSociety.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ["SUPER_ADMIN", "ADMIN_SOCIETE"] },
      },
    });
    if (!callerAccess) {
      return { success: false, error: "Droits insuffisants" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, firstName: true, lastLoginAt: true },
    });
    if (!user) return { success: false, error: "Utilisateur introuvable" };

    // Pas de renvoi si l'utilisateur s'est déjà connecté
    if (user.lastLoginAt) {
      return { success: false, error: "Cet utilisateur a déjà activé son compte" };
    }

    // Générer un nouveau token (72h)
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { resetToken, resetTokenExpiresAt },
    });

    const baseUrl = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    await sendNewUserInviteEmail({
      to: user.email,
      name: `${user.name ?? ""}${user.firstName ? " " + user.firstName : ""}`.trim() || user.email,
      email: user.email,
      resetUrl,
      appUrl: baseUrl,
    });

    revalidatePath("/compte/utilisateurs");
    return { success: true };
  } catch (error) {
    console.error("[resendInvitation]", error);
    return { success: false, error: "Erreur lors du renvoi de l'invitation" };
  }
}

export async function assignUserToSociety(
  input: AssignUserToSocietyInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    const parsed = assignUserToSocietySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { userId, societyId, role } = parsed.data;

    // Seuls ADMIN_SOCIETE+ peuvent assigner des utilisateurs
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    // Vérifier abonnement actif et limite d'utilisateurs
    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };
    const userCheck = await checkUserLimit(societyId);
    if (!userCheck.allowed) return { success: false, error: userCheck.message };

    // Un ADMIN_SOCIETE ne peut pas créer de SUPER_ADMIN
    if (role === "SUPER_ADMIN") {
      await requireSuperAdmin(session.user.id);
    }

    await prisma.userSociety.upsert({
      where: {
        userId_societyId: { userId, societyId },
      },
      create: { userId, societyId, role },
      update: { role },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "UserSociety",
      entityId: `${userId}-${societyId}`,
      details: { targetUserId: userId, role },
    });

    revalidatePath("/administration/utilisateurs");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[assignUserToSociety]", error);
    return { success: false, error: "Erreur lors de l'assignation" };
  }
}

export async function removeUserFromSociety(
  userId: string,
  societyId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    // Empêcher de se retirer soi-même
    if (userId === session.user.id) {
      return { success: false, error: "Vous ne pouvez pas vous retirer vous-même" };
    }

    await prisma.userSociety.delete({
      where: {
        userId_societyId: { userId, societyId },
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "UserSociety",
      entityId: `${userId}-${societyId}`,
      details: { removedUserId: userId },
    });

    revalidatePath("/administration/utilisateurs");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[removeUserFromSociety]", error);
    return { success: false, error: "Erreur lors du retrait" };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSuperAdmin(session.user.id);

    // Empêcher de se supprimer soi-même
    if (userId === session.user.id) {
      return { success: false, error: "Vous ne pouvez pas supprimer votre propre compte" };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "Utilisateur introuvable" };

    // Supprimer les relations puis l'utilisateur en transaction
    await prisma.$transaction([
      prisma.userSociety.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.auditLog.updateMany({ where: { userId }, data: { userId: null } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await createAuditLog({
      societyId: "system",
      userId: session.user.id,
      action: "DELETE",
      entity: "User",
      entityId: userId,
      details: { deletedEmail: user.email },
    });

    revalidatePath("/administration/utilisateurs");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[deleteUser]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function changePassword(
  input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return { success: false, error: "Utilisateur introuvable" };
    }

    const isValid = await compare(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Mot de passe actuel incorrect" };
    }

    const newHash = await hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    });

    return { success: true };
  } catch (error) {
    console.error("[changePassword]", error);
    return { success: false, error: "Erreur lors du changement de mot de passe" };
  }
}

export async function getUsersNotInSociety(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

  // Récupérer tous les userId déjà dans la société
  const existing = await prisma.userSociety.findMany({
    where: { societyId },
    select: { userId: true },
  });
  const existingIds = existing.map((e) => e.userId);

  return prisma.user.findMany({
    where: {
      isActive: true,
      id: { notIn: existingIds },
    },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getUsers(societyId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  if (societyId) {
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const memberships = await prisma.userSociety.findMany({
      where: { societyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            emailCopyEnabled: true,
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    return memberships.map((m) => ({
      ...m.user,
      role: m.role,
    }));
  }

  // SUPER_ADMIN : tous les utilisateurs
  await requireSuperAdmin(session.user.id);

  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      userSocieties: {
        include: { society: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });
}

// ─── RBAC v2 : Module permissions ─────────────────────────────────────────────

/**
 * Retrieves the module permissions for a user in a society.
 * Returns the role and effective permissions (custom or defaults).
 */
export async function getModulePermissions(
  userId: string,
  societyId: string
): Promise<ActionResult<{ role: string; modulePermissions: ModulePermissions; isCustom: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const membership = await prisma.userSociety.findUnique({
      where: { userId_societyId: { userId, societyId } },
    });

    if (!membership) {
      return { success: false, error: "Utilisateur non membre de cette société" };
    }

    const { getDefaultPermissions } = await import("@/lib/permissions");
    const raw = membership.modulePermissions;
    const isCustom = raw != null;
    const modulePermissions: ModulePermissions = isCustom
      ? (raw as ModulePermissions)
      : getDefaultPermissions(membership.role);

    return {
      success: true,
      data: { role: membership.role, modulePermissions, isCustom },
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[getModulePermissions]", error);
    return { success: false, error: "Erreur lors de la récupération des permissions" };
  }
}

/**
 * Updates the per-module permissions for a user in a society.
 * Only ADMIN_SOCIETE+ can update permissions.
 * Setting permissions to null resets to role defaults.
 */
export async function updateModulePermissions(
  input: UpdateModulePermissionsInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    const parsed = updateModulePermissionsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { userId, societyId, modulePermissions } = parsed.data;

    // Only ADMIN_SOCIETE+ can change permissions
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    // Verify target user is a member
    const membership = await prisma.userSociety.findUnique({
      where: { userId_societyId: { userId, societyId } },
    });
    if (!membership) {
      return { success: false, error: "Utilisateur non membre de cette société" };
    }

    // Cannot modify SUPER_ADMIN permissions unless you are one
    if (membership.role === "SUPER_ADMIN") {
      await requireSuperAdmin(session.user.id);
    }

    // Cannot modify your own permissions
    if (userId === session.user.id) {
      return { success: false, error: "Vous ne pouvez pas modifier vos propres permissions" };
    }

    await prisma.userSociety.update({
      where: { userId_societyId: { userId, societyId } },
      data: { modulePermissions: modulePermissions as Record<string, string[]> },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "UserSociety",
      entityId: `${userId}-${societyId}`,
      details: {
        targetUserId: userId,
        action: "UPDATE_MODULE_PERMISSIONS",
        modulePermissions,
      },
    });

    revalidatePath(`/administration/utilisateurs/${userId}/permissions`);
    revalidatePath("/administration/utilisateurs");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateModulePermissions]", error);
    return { success: false, error: "Erreur lors de la mise à jour des permissions" };
  }
}

/**
 * Resets module permissions for a user back to role defaults (sets to null).
 */
export async function resetModulePermissions(
  userId: string,
  societyId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const membership = await prisma.userSociety.findUnique({
      where: { userId_societyId: { userId, societyId } },
    });
    if (!membership) {
      return { success: false, error: "Utilisateur non membre de cette société" };
    }

    await prisma.userSociety.update({
      where: { userId_societyId: { userId, societyId } },
      data: { modulePermissions: Prisma.DbNull },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "UserSociety",
      entityId: `${userId}-${societyId}`,
      details: {
        targetUserId: userId,
        action: "RESET_MODULE_PERMISSIONS",
      },
    });

    revalidatePath(`/administration/utilisateurs/${userId}/permissions`);
    revalidatePath("/administration/utilisateurs");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[resetModulePermissions]", error);
    return { success: false, error: "Erreur lors de la réinitialisation des permissions" };
  }
}

// ─── Gestion globale des utilisateurs (multi-propriétaire / multi-société) ──

export type UserAccess = {
  proprietaireId: string;
  proprietaireLabel: string;
  societyId: string;
  societyName: string;
  role: string;
};

export type ManagedUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  emailCopyEnabled: boolean;
  accesses: UserAccess[];
};

export type AvailableSociety = {
  id: string;
  name: string;
  proprietaireId: string;
  proprietaireLabel: string;
};

/**
 * Récupère tous les utilisateurs gérés par l'administrateur courant,
 * regroupés avec leurs accès propriétaire → société → rôle.
 */
export async function getAllManagedUsers(): Promise<
  ActionResult<{ users: ManagedUser[]; societies: AvailableSociety[] }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const proprietaires = await prisma.proprietaire.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        label: true,
        societies: {
          select: {
            id: true,
            name: true,
            userSocieties: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    firstName: true,
                    isActive: true,
                    lastLoginAt: true,
                    emailCopyEnabled: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const userMap = new Map<string, ManagedUser>();
    const societies: AvailableSociety[] = [];

    for (const prop of proprietaires) {
      for (const society of prop.societies) {
        societies.push({
          id: society.id,
          name: society.name,
          proprietaireId: prop.id,
          proprietaireLabel: prop.label,
        });

        for (const ms of society.userSocieties) {
          const u = ms.user;
          if (!userMap.has(u.id)) {
            userMap.set(u.id, {
              id: u.id,
              email: u.email,
              name: u.name,
              firstName: u.firstName,
              isActive: u.isActive,
              lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
              emailCopyEnabled: u.emailCopyEnabled,
              accesses: [],
            });
          }
          userMap.get(u.id)!.accesses.push({
            proprietaireId: prop.id,
            proprietaireLabel: prop.label,
            societyId: society.id,
            societyName: society.name,
            role: ms.role,
          });
        }
      }
    }

    return {
      success: true,
      data: {
        users: Array.from(userMap.values()).sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "")
        ),
        societies,
      },
    };
  } catch (error) {
    console.error("[getAllManagedUsers]", error);
    return { success: false, error: "Erreur lors de la récupération" };
  }
}

// ─── Toggle BCC email copy ───────────────────────────────────────────────────

/**
 * Active/désactive la copie cachée des emails pour un utilisateur.
 * - ADMIN_SOCIETE peut le faire pour n'importe quel membre de la société.
 * - Les autres rôles ne peuvent le faire que pour eux-mêmes.
 */
export async function toggleEmailCopy(
  targetUserId: string,
  societyId: string,
  enabled: boolean
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    // Vérifier l'accès à la société
    const membership = await prisma.userSociety.findUnique({
      where: { userId_societyId: { userId: session.user.id, societyId } },
    });
    if (!membership) {
      return { success: false, error: "Accès refusé" };
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN_SOCIETE"].includes(membership.role);
    const isSelf = targetUserId === session.user.id;

    // Un non-admin ne peut modifier que sa propre copie cachée
    if (!isAdmin && !isSelf) {
      return { success: false, error: "Vous ne pouvez modifier cette option que pour votre propre compte" };
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { emailCopyEnabled: enabled },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "User",
      entityId: targetUserId,
      details: { action: "TOGGLE_EMAIL_COPY", enabled, targetUserId },
    });

    revalidatePath("/compte/utilisateurs");
    return { success: true };
  } catch (error) {
    console.error("[toggleEmailCopy]", error);
    return { success: false, error: "Erreur lors de la modification" };
  }
}
