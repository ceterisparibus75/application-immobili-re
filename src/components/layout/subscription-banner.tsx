"use client";

import { useEffect, useRef, useState } from "react";
import { useSociety } from "@/providers/society-provider";
import { AlertTriangle, Clock, CreditCard, X } from "lucide-react";
import Link from "next/link";
import { syncAllAdminSubscriptions } from "@/actions/subscription";

const SESSION_SYNC_KEY = "sub-sync-done";

type BannerState = {
  type: "trial_warning" | "trial_expired" | "past_due" | "canceled" | null;
  message: string;
  daysLeft?: number;
};

export function SubscriptionBanner() {
  const { activeSociety } = useSociety();
  const [banner, setBanner] = useState<BannerState>({ type: null, message: "" });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const syncedRef = useRef(false);

  const societyId = activeSociety?.id;

  // Synchroniser tous les abonnements admin une fois par session navigateur
  useEffect(() => {
    if (syncedRef.current) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_SYNC_KEY)) {
      syncedRef.current = true;
      return;
    }
    syncedRef.current = true;
    syncAllAdminSubscriptions()
      .then(() => sessionStorage.setItem(SESSION_SYNC_KEY, "1"))
      .catch(() => {/* silencieux */});
  }, []);

  useEffect(() => {
    if (!societyId) return;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/subscription/status?societyId=${societyId}`);
        if (!res.ok) return;
        const data = await res.json();
        setBanner(data);
      } catch {
        // silently ignore
      }
    }
    checkStatus();
  }, [societyId]);

  if (!banner.type || dismissed === societyId) return null;

  const styles = {
    trial_warning: "bg-[var(--color-status-caution-bg)] border-[var(--color-status-caution)]/30 text-[var(--color-status-caution)]",
    trial_expired: "bg-[var(--color-status-negative-bg)] border-[var(--color-status-negative)]/30 text-[var(--color-status-negative)]",
    past_due: "bg-[var(--color-status-caution-bg)] border-[var(--color-status-caution)]/30 text-[var(--color-status-caution)]",
    canceled: "bg-[var(--color-status-negative-bg)] border-[var(--color-status-negative)]/30 text-[var(--color-status-negative)]",
  };

  const icons = {
    trial_warning: <Clock className="h-4 w-4 shrink-0" />,
    trial_expired: <AlertTriangle className="h-4 w-4 shrink-0" />,
    past_due: <CreditCard className="h-4 w-4 shrink-0" />,
    canceled: <AlertTriangle className="h-4 w-4 shrink-0" />,
  };

  return (
    <div className={`flex items-center gap-3 px-6 py-2.5 text-sm border-b ${styles[banner.type]}`}>
      {icons[banner.type]}
      <span className="flex-1">{banner.message}</span>
      <Link
        href="/compte/abonnement"
        className="shrink-0 px-3 py-1 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
      >
        {banner.type === "trial_warning" ? "Souscrire" : "Gérer l'abonnement"}
      </Link>
      {banner.type === "trial_warning" && (
        <button onClick={() => setDismissed(societyId ?? null)} className="shrink-0 p-0.5 rounded hover:bg-[var(--color-status-caution)]/10" aria-label="Fermer la bannière">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
