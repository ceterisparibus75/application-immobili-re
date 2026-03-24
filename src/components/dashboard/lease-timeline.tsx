"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { LeaseTimelineItem } from "@/actions/analytics";

function DaysBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge variant="destructive">Expiré</Badge>;
  if (days <= 30) return <Badge variant="destructive">J-{days}</Badge>;
  if (days <= 90) return <Badge variant="warning">J-{days}</Badge>;
  return <Badge variant="secondary">J-{days}</Badge>;
}

export function LeaseTimeline({ data }: { data: LeaseTimelineItem[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Aucun bail actif
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1">
      {data.map((lease) => (
        <Link
          key={lease.id}
          href={`/baux/${lease.id}`}
          className="block group"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {lease.tenantName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{lease.lotRef}</p>
            </div>
            <DaysBadge days={lease.daysRemaining} />
          </div>
          {/* Barre de progression du bail */}
          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{
                width: `${lease.progressPct}%`,
                backgroundColor:
                  lease.daysRemaining <= 30
                    ? "#ef4444"
                    : lease.daysRemaining <= 90
                    ? "#f59e0b"
                    : "#3b82f6",
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-xs text-muted-foreground">{lease.startDate}</span>
            <span className="text-xs text-muted-foreground">{lease.endDate}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
