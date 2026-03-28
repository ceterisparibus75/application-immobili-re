"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, Calendar, AlertTriangle, Wrench, FileSignature, CreditCard, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSociety } from "@/providers/society-provider";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import type { Notification, NotificationType } from "@/generated/prisma/client";

const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  BAIL_EXPIRING: Calendar,
  INVOICE_OVERDUE: AlertTriangle,
  DIAGNOSTIC_EXPIRING: AlertTriangle,
  PAYMENT_RECEIVED: Check,
  MAINTENANCE_COMPLETED: Wrench,
  DOCUMENT_SIGNED: FileSignature,
  SEPA_PAYMENT_FAILED: AlertTriangle,
  SEPA_PAYMENT_CONFIRMED: CreditCard,
  INSURANCE_EXPIRING: AlertTriangle,
  RENT_REVISION: TrendingUp,
};

export function NotificationBell() {
  const { activeSociety } = useSociety();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!activeSociety?.id) return;
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const json = await res.json() as { data: Notification[]; meta: { unreadCount: number } };
      setNotifications(json.data);
      setUnreadCount(json.meta.unreadCount);
    } catch { /* silencieux */ }
  }, [activeSociety?.id]);

  useEffect(() => {
    if (!activeSociety?.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();

    const es = new EventSource("/api/notifications/stream");
    esRef.current = es;
    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as { type: string; unreadCount?: number; notifications?: Notification[] };
      if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount);
      if (data.notifications?.length) {
        setNotifications((prev) => {
          const ids = new Set(prev.map((n) => n.id));
          const fresh = (data.notifications ?? []).filter((n) => !ids.has(n.id));
          return [...fresh, ...prev].slice(0, 10);
        });
      }
    };
    es.onerror = () => es.close();

    const fallback = setInterval(fetchNotifications, 30000);
    return () => { es.close(); clearInterval(fallback); };
  }, [activeSociety?.id, fetchNotifications]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", ids: [id] }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 text-[10px] bg-destructive text-destructive-foreground border-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={markAllRead}>
              Tout marquer comme lu
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune notification</p>
          ) : (
            notifications.map((notif) => {
              const Icon = TYPE_ICONS[notif.type] ?? Bell;
              return (
                <div
                  key={notif.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer",
                    !notif.isRead && "bg-primary/5"
                  )}
                  onClick={() => { if (!notif.isRead) markRead(notif.id); }}
                >
                  <Icon className={cn("mt-0.5 shrink-0 h-4 w-4", !notif.isRead ? "text-primary" : "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    {notif.link ? (
                      <Link href={notif.link} className="block">
                        <p className={cn("text-sm font-medium truncate", !notif.isRead && "text-primary")}>{notif.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                      </Link>
                    ) : (
                      <>
                        <p className={cn("text-sm font-medium truncate", !notif.isRead && "text-primary")}>{notif.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                      </>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  {!notif.isRead && <div className="mt-2 shrink-0 h-2 w-2 rounded-full bg-primary" />}
                </div>
              );
            })
          )}
        </div>
        <div className="p-2 border-t">
          <Link href="/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
              Voir toutes les notifications
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
