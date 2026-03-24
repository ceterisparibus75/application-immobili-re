import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) return NextResponse.json({ error: "Société non sélectionnée" }, { status: 400 });

  const userId = session.user.id;

  const encoder = new TextEncoder();
  let lastId: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Envoyer le compte non-lu initial
      const count = await prisma.notification.count({
        where: { userId, societyId, isRead: false },
      });
      send({ type: "init", unreadCount: count });

      // Polling toutes les 30s pour les nouvelles notifications
      const interval = setInterval(async () => {
        try {
          const where = {
            userId,
            societyId,
            isRead: false,
            ...(lastId ? { id: { gt: lastId } } : {}),
          };
          const newNotifs = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: "asc" },
            take: 10,
          });

          if (newNotifs.length > 0) {
            lastId = newNotifs[newNotifs.length - 1].id;
            const total = await prisma.notification.count({
              where: { userId, societyId, isRead: false },
            });
            send({ type: "update", notifications: newNotifs, unreadCount: total });
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 30000);

      // Heartbeat toutes les 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
