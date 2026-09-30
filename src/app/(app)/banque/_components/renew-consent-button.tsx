"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useSociety } from "@/providers/society-provider";
import { renewOpenBankingConsent } from "@/actions/bank-connection";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  connectionId: string;
  label?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

export function RenewConsentButton({
  connectionId,
  label = "Renouveler le consentement",
  variant = "default",
  size = "sm",
}: Props) {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRenew() {
    if (!activeSociety) return;
    setError(null);
    startTransition(async () => {
      const res = await renewOpenBankingConsent(activeSociety.id, connectionId);
      if (res.success && res.data?.authLink) {
        window.location.href = res.data.authLink;
      } else {
        setError(res.error ?? "Erreur lors du renouvellement");
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} onClick={handleRenew} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
