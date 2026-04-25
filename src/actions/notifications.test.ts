import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));

import {
  createNotification,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "./notifications";

describe("notifications actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée une notification si l'utilisateur cible appartient à la société", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.userSociety.findFirst.mockResolvedValue({ userId: "user-2", societyId: "society-1" } as never);
    prismaMock.notification.create.mockResolvedValue({ id: "notif-1" } as never);

    const result = await createNotification({
      userId: "user-2",
      societyId: "society-1",
      type: "TICKET_CREATED",
      title: "Alerte",
      message: "Document manquant",
      link: "/documents",
    });

    expect(result).toEqual({ id: "notif-1" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        societyId: "society-1",
        type: "TICKET_CREATED",
        title: "Alerte",
        message: "Document manquant",
        link: "/documents",
      },
    });
  });

  it("retourne null et 0 en lecture silencieuse si non authentifié", async () => {
    mockUnauthenticated();

    const notifications = await getNotifications("society-1");
    const unread = await getUnreadCount("society-1");

    expect(notifications).toBeNull();
    expect(unread).toBe(0);
  });

  it("lance une erreur si l'utilisateur cible n'est pas membre de la société (ligne 28)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.userSociety.findFirst.mockResolvedValue(null as never);
    await expect(
      createNotification({
        userId: "user-2",
        societyId: "society-1",
        type: "TICKET_CREATED",
        title: "Test",
        message: "Test",
        link: "/test",
      })
    ).rejects.toThrow("Utilisateur cible non membre");
  });

  it("retourne les notifications de l'utilisateur connecté (ligne 49)", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.notification.findMany.mockResolvedValue([{ id: "notif-1", title: "Test" }] as never);
    const result = await getNotifications("society-1");
    expect(result).toEqual([{ id: "notif-1", title: "Test" }]);
  });

  it("retourne le nombre de notifications non lues (ligne 62)", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.notification.count.mockResolvedValue(3 as never);
    const count = await getUnreadCount("society-1");
    expect(count).toBe(3);
  });

  it("marque comme lu, tout lit et supprime dans le scope de l'utilisateur courant", async () => {
    mockAuthSession(UserRole.LECTURE);

    await markAsRead("society-1", "notif-1");
    await markAllAsRead("society-1");
    await deleteNotification("society-1", "notif-1");

    expect(prismaMock.notification.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "notif-1", userId: "user-1", societyId: "society-1" },
      data: { isRead: true, readAt: expect.any(Date) },
    });
    expect(prismaMock.notification.updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: "user-1", societyId: "society-1", isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: "notif-1", userId: "user-1", societyId: "society-1" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/notifications");
  });
});
