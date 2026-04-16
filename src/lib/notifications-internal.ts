import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/client";

/**
 * Internal-only notification creation for server-side use by cron jobs, webhooks, etc.
 * This module is NOT a Server Action file — it cannot be called from the client.
 */
export async function createInternalNotification(input: {
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
