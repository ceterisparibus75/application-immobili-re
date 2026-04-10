"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncAllAccounts } from "@/actions/bank-connection";
import { toast } from "sonner";

export default function SyncAllButton({ societyId }: { societyId: string }) {
  const [syncing, startSync] = useTransition();

  function handleSync() {
    startSync(async () => {
      const result = await syncAllAccounts(societyId);
      if (result.success) {
        const { totalImported, accountsSynced } = result.data!;
        toast.success(
          totalImported === 0
            ? `${accountsSynced} compte(s) synchronisé(s) — aucune nouvelle transaction`
            : `${totalImported} transaction(s) importée(s) sur ${accountsSynced} compte(s)`
        );
      } else {
        toast.error(result.error ?? "Erreur lors de la synchronisation");
      }
    });
  }

  return (
    <Button
      variant="outline"
      onClick={handleSync}
      disabled={syncing}
      className="gap-1.5"
    >
      <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Synchronisation..." : "Tout synchroniser"}
    </Button>
  );
}
