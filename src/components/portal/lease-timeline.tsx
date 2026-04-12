"use client";

import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FileText, CreditCard, Shield, AlertTriangle, Key,
  Calendar, Clock, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TimelineEvent {
  id: string;
  type: "lease_start" | "payment" | "invoice" | "insurance" | "renewal" | "ticket" | "document" | "alert";
  title: string;
  description?: string;
  date: string;
  status?: "success" | "warning" | "error" | "info";
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  lease_start: { icon: Key, color: "bg-emerald-500 text-white" },
  payment: { icon: CreditCard, color: "bg-green-500 text-white" },
  invoice: { icon: FileText, color: "bg-blue-500 text-white" },
  insurance: { icon: Shield, color: "bg-violet-500 text-white" },
  renewal: { icon: Calendar, color: "bg-cyan-500 text-white" },
  ticket: { icon: MessageSquare, color: "bg-pink-500 text-white" },
  document: { icon: FileText, color: "bg-slate-500 text-white" },
  alert: { icon: AlertTriangle, color: "bg-amber-500 text-white" },
};

const STATUS_BADGE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LeaseTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm">Aucun événement récent</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[17px] top-3 bottom-3 w-0.5 bg-border" />

      <div className="space-y-0">
        {events.map((event) => {
          const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.document;
          const Icon = config.icon;

          return (
            <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Icon dot */}
              <div className={cn("relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm", config.color)}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{event.description}</p>
                    )}
                  </div>
                  {event.status && (
                    <span className={cn("shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_BADGE[event.status])}>
                      {event.status === "success" ? "OK" : event.status === "warning" ? "Attention" : event.status === "error" ? "Urgent" : "Info"}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {format(new Date(event.date), "dd MMM yyyy", { locale: fr })}
                  {" · "}
                  {formatDistanceToNow(new Date(event.date), { addSuffix: true, locale: fr })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
