"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncAccountTransactions } from "@/actions/bank-connection";
import { toast } from "sonner";

interface SyncButtonProps {
  bankAccountId: string;
  societyId: string;
}

export default function SyncButton({ bankAccountId, societyId }: SyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSync() {
    setIsLoading(true);
    const result = await syncAccountTransactions(societyId, bankAccountId);
    setIsLoading(false);

    if (result.success) {
      const count = result.data?.imported ?? 0;
      toast.success(
        count === 0
          ? "Aucune nouvelle transaction"
          : `${count} transaction${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}`,
        {
          description: count > 0 ? "Les données Cash-flow ont été mises à jour." : undefined,
          action: count > 0
            ? { label: "Voir le Cash-flow", onClick: () => window.location.assign("/comptabilite/cashflow") }
            : undefined,
        }
      );
    } else {
      toast.error(result.error ?? "Erreur lors de la synchronisation");
    }
  }

  return (
    <Button variant="outline" onClick={handleSync} disabled={isLoading}>
      <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      {isLoading ? "Sync..." : "Synchroniser"}
    </Button>
  );
}
