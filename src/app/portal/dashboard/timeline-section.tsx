"use client";

import { useState, useEffect } from "react";
import { LeaseTimeline, type TimelineEvent } from "@/components/portal/lease-timeline";

export function TimelineSection() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/timeline");
        if (!res.ok) return;
        const json = await res.json();
        setEvents(json.data ?? []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-3/4 bg-muted rounded" />
              <div className="h-2 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <LeaseTimeline events={events} />;
}
