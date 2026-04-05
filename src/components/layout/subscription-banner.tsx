"use client";

import { useEffect, useState } from "react";
import { useSociety } from "@/providers/society-provider";
import { AlertTriangle, Clock, CreditCard, X } from "lucide-react";
import Link from "next/link";

type BannerState = {
  type: "trial_warning" | "trial_expired" | "past_due" | "canceled" | null;
  message: string;
  daysLeft?: number;
};

export function SubscriptionBanner() {
  const { activeSociety } = useSociety();
  const [banner, setBanner] = useState<BannerState>({ type: null, message: "" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!activeSociety?.id) return;
    setDismissed(false);

    async function checkStatus() {
      try {
        const res = await fetch(`/api/subscription/status?societyId=${activeSociety!.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setBanner(data);
      } catch {
        // silently ignore
      }
    }
    checkStatus();
  }, [activeSociety?.id]);

  if (!banner.type || dismissed) return null;

  const styles = {
    trial_warning: "bg-amber-50 border-amber-200 text-amber-800",
    trial_expired: "bg-red-50 border-red-200 text-red-800",
    past_due: "bg-orange-50 border-orange-200 text-orange-800",
    canceled: "bg-red-50 border-red-200 text-red-800",
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
        <button onClick={() => setDismissed(true)} className="shrink-0 p-0.5 rounded hover:bg-amber-200/50">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
