import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";

export async function GET(req: NextRequest) {
  const context = await requireActiveSocietyRouteContext();
  if (context instanceof NextResponse) return context;

  const { societyId, userId } = context;

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "20");
  const unreadOnly = url.searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      societyId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, societyId, isRead: false },
  });

  return NextResponse.json({ data: notifications, meta: { unreadCount } });
}

export async function PATCH(req: NextRequest) {
  const context = await requireActiveSocietyRouteContext();
  if (context instanceof NextResponse) return context;

  const { societyId, userId } = context;

  const { action, ids } = await req.json() as { action: "mark_read" | "mark_all_read"; ids?: string[] };

  if (action === "mark_all_read") {
    await prisma.notification.updateMany({
      where: { userId, societyId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  } else if (action === "mark_read" && ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId, societyId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
