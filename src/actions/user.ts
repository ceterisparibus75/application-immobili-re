"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, requireSuperAdmin, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { hash, compare } from "bcryptjs";
import {
  createUserSchema,
  updateUserSchema,
  assignUserToSocietySchema,
  changePasswordSchema,
  type CreateUserInput,
  type AssignUserToSocietyInput,
} from "@/validations/user";
import { revalidatePath } from "next/cache";
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

    const passwordHash = await hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        firstName: data.firstName || null,
        passwordHash,
      },
    });

    revalidatePath("/administration/utilisateurs");

    return { success: true, data: { id: user.id } };
  } catch (error) {
    console.error("[createUser]", error);
    return { success: false, error: "Erreur lors de la création de l'utilisateur" };
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
