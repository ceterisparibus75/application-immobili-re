"use server";

import { getOptionalAuthenticatedActionContext } from "@/lib/action-auth";
import { requireSocietyActionContext } from "@/lib/action-society";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { NotificationType } from "@/generated/prisma/client";

// ── Créer une notification (interne / depuis webhook) ──────
// This function requires authentication and verifies the caller
// has access to the target society before creating a notification.

export async function createNotification(input: {
  userId: string;
  societyId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  await requireSocietyActionContext(input.societyId);

  // Verify the target user also belongs to this society
  const targetMembership = await prisma.userSociety.findFirst({
    where: { userId: input.userId, societyId: input.societyId },
  });
  if (!targetMembership) {
    throw new Error("Utilisateur cible non membre de cette société");
  }

  return prisma.notification.create({
    data: {
      userId: input.userId,
      societyId: input.societyId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    },
  });
}

// ── Récupérer les notifications de l'utilisateur ──────────

export async function getNotifications(societyId: string, limit = 20) {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return null;

  return prisma.notification.findMany({
    where: { userId: context.userId, societyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Nombre de notifications non lues ──────────────────────

export async function getUnreadCount(societyId: string): Promise<number> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return 0;

  return prisma.notification.count({
    where: { userId: context.userId, societyId, isRead: false },
  });
}

// ── Marquer comme lu ───────────────────────────────────────

export async function markAsRead(
  societyId: string,
  notificationId: string
): Promise<void> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: context.userId, societyId },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath("/notifications");
}

// ── Tout marquer comme lu ─────────────────────────────────

export async function markAllAsRead(societyId: string): Promise<void> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return;

  await prisma.notification.updateMany({
    where: { userId: context.userId, societyId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath("/notifications");
}

// ── Supprimer une notification ─────────────────────────────

export async function deleteNotification(
  societyId: string,
  notificationId: string
): Promise<void> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return;

  await prisma.notification.deleteMany({
    where: { id: notificationId, userId: context.userId, societyId },
  });

  revalidatePath("/notifications");
}
