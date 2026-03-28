"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSociety } from "@/providers/society-provider";
import { formatDistanceToNow, format } from "date-fns";
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

export default function NotificationsPage() {
  const { activeSociety } = useSociety();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeSociety?.id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=100");
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Aucune notification</p>
            <p className="text-sm">Vous recevrez ici des alertes importantes sur vos baux, factures et documents.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={cn("transition-colors cursor-pointer hover:bg-accent/30", !notif.isRead && "border-primary/30 bg-primary/5")}
              onClick={() => { if (!notif.isRead) markRead(notif.id); }}
            >
              <CardContent className="flex gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[10px]", TYPE_COLORS[notif.type])}>
                      {TYPE_LABELS[notif.type] ?? notif.type}
                    </Badge>
                    {!notif.isRead && <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />}
                  </div>
                  {notif.link ? (
                    <Link href={notif.link} className="block mt-1">
                      <p className="font-medium text-sm">{notif.title}</p>
                    </Link>
                  ) : (
                    <p className="font-medium text-sm mt-1">{notif.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(notif.createdAt), "dd/MM/yyyy HH:mm")} ·{" "}
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                {!notif.isRead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); markRead(notif.id); }}
                    title="Marquer comme lu"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
