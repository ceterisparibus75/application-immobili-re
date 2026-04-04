"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSociety } from "@/providers/society-provider";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import type { Notification } from "@/generated/prisma/client";

const TYPE_LABELS: Record<string, string> = {
  BAIL_EXPIRING: "Bail",
  INVOICE_OVERDUE: "Facture",
  DIAGNOSTIC_EXPIRING: "Diagnostic",
  PAYMENT_RECEIVED: "Paiement",
  MAINTENANCE_COMPLETED: "Maintenance",
  DOCUMENT_SIGNED: "Signature",
  SEPA_PAYMENT_FAILED: "SEPA",
  SEPA_PAYMENT_CONFIRMED: "SEPA",
  INSURANCE_EXPIRING: "Assurance",
};

const TYPE_COLORS: Record<string, string> = {
  BAIL_EXPIRING: "bg-yellow-100 text-yellow-800",
  INVOICE_OVERDUE: "bg-red-100 text-red-800",
  DIAGNOSTIC_EXPIRING: "bg-orange-100 text-orange-800",
  PAYMENT_RECEIVED: "bg-green-100 text-green-800",
  MAINTENANCE_COMPLETED: "bg-blue-100 text-blue-800",
  DOCUMENT_SIGNED: "bg-purple-100 text-purple-800",
  SEPA_PAYMENT_FAILED: "bg-red-100 text-red-800",
  SEPA_PAYMENT_CONFIRMED: "bg-green-100 text-green-800",
  INSURANCE_EXPIRING: "bg-orange-100 text-orange-800",
};

export function DashboardNotifications() {
  const { activeSociety } = useSociety();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeSociety?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const json = await res.json() as { data: Notification[]; meta: { unreadCount: number } };
      setNotifications(json.data);
      setUnreadCount(json.meta.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [activeSociety?.id]);

  useEffect(() => { load(); }, [load]);

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{unreadCount}</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs gap-1 text-muted-foreground">
              <CheckCheck className="h-3 w-3" />
              Tout lu
            </Button>
          )}
        </div>
        <CardDescription>Alertes et événements récents</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">Aucune notification</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "rounded-md px-3 py-2 transition-colors cursor-pointer hover:bg-accent/40",
                  !notif.isRead && "bg-primary/5 border border-primary/20"
                )}
                onClick={() => { if (!notif.isRead) markRead(notif.id); }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant="outline" className={cn("text-[9px] px-1 py-0", TYPE_COLORS[notif.type])}>
                        {TYPE_LABELS[notif.type] ?? notif.type}
                      </Badge>
                      {!notif.isRead && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    {notif.link ? (
                      <Link href={notif.link} className="block">
                        <p className="text-xs font-medium leading-tight truncate">{notif.title}</p>
                      </Link>
                    ) : (
                      <p className="text-xs font-medium leading-tight truncate">{notif.title}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); markRead(notif.id); }}
                      title="Marquer comme lu"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
