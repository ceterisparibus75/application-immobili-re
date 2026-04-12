"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus, Edit3, Trash2, FileText, CreditCard, Users, MessageSquare, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  entityLabel?: string;
  createdAt: string;
  link?: string;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  CREATE: Plus,
  UPDATE: Edit3,
  DELETE: Trash2,
  GENERATE_PDF: FileText,
  PAYMENT: CreditCard,
  INVITE: Users,
  COMMENT: MessageSquare,
  VIEW: Eye,
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "a créé",
  UPDATE: "a modifié",
  DELETE: "a supprimé",
  GENERATE_PDF: "a généré",
  PAYMENT: "a enregistré un paiement sur",
  INVITE: "a invité",
  COMMENT: "a commenté",
  VIEW: "a consulté",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500/10 text-emerald-600",
  UPDATE: "bg-blue-500/10 text-blue-600",
  DELETE: "bg-red-500/10 text-red-600",
  GENERATE_PDF: "bg-violet-500/10 text-violet-600",
  PAYMENT: "bg-amber-500/10 text-amber-600",
  INVITE: "bg-cyan-500/10 text-cyan-600",
  COMMENT: "bg-pink-500/10 text-pink-600",
  VIEW: "bg-slate-500/10 text-slate-600",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/audit?limit=20&format=feed");
        if (!res.ok) return;
        const json = await res.json();
        setActivities(json.data ?? []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 bg-muted rounded" />
              <div className="h-2 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucune activité récente
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => {
        const Icon = ACTION_ICONS[activity.action] ?? Edit3;
        const color = ACTION_COLORS[activity.action] ?? "bg-slate-500/10 text-slate-600";
        const actionLabel = ACTION_LABELS[activity.action] ?? "a effectué une action sur";

        const content = (
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors">
            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5", color)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium text-foreground">{activity.userName}</span>
                {" "}
                <span className="text-muted-foreground">{actionLabel}</span>
                {" "}
                <span className="font-medium text-foreground">
                  {activity.entityLabel || `${activity.entity} ${activity.entityId.slice(0, 8)}…`}
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: fr })}
              </p>
            </div>
          </div>
        );

        return activity.link ? (
          <Link key={activity.id} href={activity.link} className="block">
            {content}
          </Link>
        ) : (
          <div key={activity.id}>{content}</div>
        );
      })}
    </div>
  );
}
