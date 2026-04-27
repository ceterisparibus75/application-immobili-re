import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STREAM_TTL_MS = 240_000;
const HEARTBEAT_MS = 15_000;
const POLL_MS = 30_000;

export async function GET(req: NextRequest) {
  const context = await requireActiveSocietyRouteContext();
  if (context instanceof NextResponse) return context;

  const { societyId, userId } = context;

  const encoder = new TextEncoder();
  let lastId: string | null = null;
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        cleanup?.();
        try {
          controller.close();
        } catch {
          // Le client a deja ferme la connexion.
        }
      };

      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          close();
        }
      };

      controller.enqueue(encoder.encode("retry: 10000\n\n"));

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
          close();
        }
      }, POLL_MS);

      // Heartbeat toutes les 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          close();
        }
      }, HEARTBEAT_MS);

      // Vercel coupe les fonctions longues a 300s: on ferme proprement avant.
      const ttl = setTimeout(() => {
        send({ type: "reconnect" });
        close();
      }, STREAM_TTL_MS);

      cleanup = () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        clearTimeout(ttl);
        req.signal.removeEventListener("abort", close);
      };

      req.signal.addEventListener("abort", close);
    },
    cancel() {
      cleanup?.();
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
