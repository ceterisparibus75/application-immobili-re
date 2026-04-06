"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { syncInseeIndices } from "@/actions/insee-index";

interface SyncIndicesButtonProps {
  societyId: string;
  indexTypes: string[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function SyncIndicesButton({
  societyId,
  indexTypes,
  variant = "outline",
  size = "sm",
  className,
}: SyncIndicesButtonProps) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    const result = await syncInseeIndices(societyId, indexTypes);
    setSyncing(false);

    if (result.success) {
      const totalSynced = Object.values(result.data!.synced).reduce(
        (a, b) => a + b,
        0
      );
      const errorCount = result.data!.errors.length;

      if (totalSynced > 0) {
        toast.success(
          `${totalSynced} valeur${totalSynced > 1 ? "s" : ""} synchronisée${totalSynced > 1 ? "s" : ""} depuis l'INSEE`
        );
      }
      if (errorCount > 0) {
        toast.error(result.data!.errors.join("\n"));
      }
      if (totalSynced === 0 && errorCount === 0) {
        toast.info("Les indices sont déjà à jour");
      }
    } else {
      toast.error(result.error ?? "Erreur de synchronisation");
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={syncing}
      className={className}
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      <span className="ml-1.5">
        {syncing ? "Synchronisation…" : "Synchroniser les indices"}
      </span>
    </Button>
  );
}
