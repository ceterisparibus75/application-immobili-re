"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, Check, Calendar, AlertTriangle, Wrench, FileSignature,
  CreditCard, TrendingUp, MessageSquare, Settings, Filter,
} from "lucide-react";
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

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

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
  TICKET_CREATED: MessageSquare,
  TICKET_REPLY: MessageSquare,
  TICKET_STATUS_CHANGED: MessageSquare,
};

type UrgencyLevel = "urgent" | "action" | "info";

const TYPE_URGENCY: Record<NotificationType, UrgencyLevel> = {
  INVOICE_OVERDUE: "urgent",
  SEPA_PAYMENT_FAILED: "urgent",
  BAIL_EXPIRING: "action",
  DIAGNOSTIC_EXPIRING: "action",
  INSURANCE_EXPIRING: "action",
  RENT_REVISION: "action",
  PAYMENT_RECEIVED: "info",
  MAINTENANCE_COMPLETED: "info",
  DOCUMENT_SIGNED: "info",
  SEPA_PAYMENT_CONFIRMED: "info",
  TICKET_CREATED: "info",
  TICKET_REPLY: "info",
  TICKET_STATUS_CHANGED: "info",
};

const URGENCY_STYLES: Record<UrgencyLevel, { icon: string; bg: string; badge: string; label: string }> = {
  urgent: {
    icon: "text-destructive",
    bg: "bg-destructive/5 border-l-2 border-l-destructive",
    badge: "bg-destructive/10 text-destructive",
    label: "Urgent",
  },
  action: {
    icon: "text-amber-500",
    bg: "bg-amber-500/5 border-l-2 border-l-amber-400",
    badge: "bg-amber-500/10 text-amber-600",
    label: "Action requise",
  },
  info: {
    icon: "text-blue-500",
    bg: "",
    badge: "bg-blue-500/10 text-blue-600",
    label: "Information",
  },
};

const FILTER_OPTIONS: { value: UrgencyLevel | "all"; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "urgent", label: "Urgent" },
  { value: "action", label: "Actions" },
  { value: "info", label: "Info" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NotificationBell() {
  const { activeSociety } = useSociety();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<UrgencyLevel | "all">("all");
  const esRef = useRef<EventSource | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!activeSociety?.id) return;
    try {
      const res = await fetch("/api/notifications?limit=20");
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
          return [...fresh, ...prev].slice(0, 20);
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

  // Filtered notifications
  const filtered = filter === "all"
    ? notifications
    : notifications.filter((n) => TYPE_URGENCY[n.type] === filter);

  // Count urgent unread
  const urgentCount = notifications.filter((n) => !n.isRead && TYPE_URGENCY[n.type] === "urgent").length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className={cn("h-4 w-4", urgentCount > 0 && "text-destructive")} />
          {unreadCount > 0 && (
            <Badge className={cn(
              "absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 text-[10px] border-0",
              urgentCount > 0
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            )}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">
                {unreadCount} non lu{unreadCount > 1 ? "es" : "e"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={markAllRead}>
                Tout marquer comme lu
              </Button>
            )}
            <Link href="/notifications/preferences" onClick={() => setOpen(false)}>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Préférences">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30">
          <Filter className="h-3 w-3 text-muted-foreground/40 mr-1" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                filter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              )}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {filter === "all" ? "Aucune notification" : `Aucune notification ${FILTER_OPTIONS.find((o) => o.value === filter)?.label.toLowerCase()}`}
            </p>
          ) : (
            filtered.map((notif) => {
              const Icon = TYPE_ICONS[notif.type] ?? Bell;
              const urgency = TYPE_URGENCY[notif.type] ?? "info";
              const styles = URGENCY_STYLES[urgency];

              return (
                <div
                  key={notif.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer",
                    !notif.isRead && styles.bg,
                  )}
                  onClick={() => { if (!notif.isRead) markRead(notif.id); }}
                >
                  <div className={cn("mt-0.5 shrink-0 h-7 w-7 rounded-lg flex items-center justify-center", styles.badge)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {notif.link ? (
                        <Link href={notif.link} className="flex-1 min-w-0" onClick={() => setOpen(false)}>
                          <p className={cn("text-sm font-medium truncate", !notif.isRead && "text-foreground")}>{notif.title}</p>
                        </Link>
                      ) : (
                        <p className={cn("text-sm font-medium truncate flex-1", !notif.isRead && "text-foreground")}>{notif.title}</p>
                      )}
                      {urgency !== "info" && (
                        <span className={cn("text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0", styles.badge)}>
                          {styles.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  {!notif.isRead && <div className="mt-2 shrink-0 h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t flex items-center gap-2">
          <Link href="/notifications" className="flex-1" onClick={() => setOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
              Voir toutes les notifications
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
