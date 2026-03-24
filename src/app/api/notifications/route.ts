import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return NextResponse.json({ error: "Société non sélectionnée" }, { status: 400 });

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "20");
  const unreadOnly = url.searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      societyId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, societyId, isRead: false },
  });

  return NextResponse.json({ data: notifications, meta: { unreadCount } });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return NextResponse.json({ error: "Société non sélectionnée" }, { status: 400 });

  const { action, ids } = await req.json() as { action: "mark_read" | "mark_all_read"; ids?: string[] };

  if (action === "mark_all_read") {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, societyId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  } else if (action === "mark_read" && ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: session.user.id, societyId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
