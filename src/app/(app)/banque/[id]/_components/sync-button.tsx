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
      toast.success(
        result.data?.imported === 0
          ? "Aucune nouvelle transaction"
          : `${result.data?.imported} transaction${(result.data?.imported ?? 0) > 1 ? "s" : ""} importée${(result.data?.imported ?? 0) > 1 ? "s" : ""}`
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
