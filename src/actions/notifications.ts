"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { NotificationType } from "@prisma/client";

// ── Créer une notification (interne / depuis webhook) ──────

export async function createNotification(input: {
  userId: string;
  societyId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
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
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.notification.findMany({
    where: { userId: session.user.id, societyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Nombre de notifications non lues ──────────────────────

export async function getUnreadCount(societyId: string): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return prisma.notification.count({
    where: { userId: session.user.id, societyId, isRead: false },
  });
}

// ── Marquer comme lu ───────────────────────────────────────

export async function markAsRead(
  societyId: string,
  notificationId: string
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id, societyId },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath("/notifications");
}

// ── Tout marquer comme lu ─────────────────────────────────

export async function markAllAsRead(societyId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, societyId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath("/notifications");
}

// ── Supprimer une notification ─────────────────────────────

export async function deleteNotification(
  societyId: string,
  notificationId: string
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.deleteMany({
    where: { id: notificationId, userId: session.user.id, societyId },
  });

  revalidatePath("/notifications");
}
