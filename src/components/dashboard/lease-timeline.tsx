"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { LeaseTimelineItem } from "@/actions/analytics";

function DaysBadge({ days }: { days: number }) {
  if (days <= 0) return <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">Expiré</span>;
  if (days <= 30) return <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">J-{days}</span>;
  if (days <= 90) return <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">J-{days}</span>;
  return <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#1B4F8A]">J-{days}</span>;
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
              <p className="text-sm font-medium truncate text-[#0C2340] group-hover:text-[#1B4F8A] transition-colors">
                {lease.tenantName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{lease.lotRef}</p>
            </div>
            <DaysBadge days={lease.daysRemaining} />
          </div>
          {/* Barre de progression du bail */}
          <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{
                width: `${lease.progressPct}%`,
                background:
                  lease.daysRemaining <= 30
                    ? "#F87171"
                    : lease.daysRemaining <= 90
                    ? "#FBBF24"
                    : "linear-gradient(90deg, #1B4F8A, #22B8CF)",
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
