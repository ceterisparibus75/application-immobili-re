"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Check } from "lucide-react";
import { syncTenantsToContacts } from "@/actions/tenant";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function SyncTenantsButton({ societyId }: { societyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSync() {
    setLoading(true);
    const result = await syncTenantsToContacts(societyId);
    setLoading(false);

    if (result.success && result.data) {
      setDone(true);
      const { created, updated } = result.data;
      if (created === 0 && updated === 0) {
        toast.info("Tous les locataires sont déjà synchronisés");
      } else {
        toast.success(
          `${created} contact${created !== 1 ? "s" : ""} créé${created !== 1 ? "s" : ""}` +
          (updated > 0 ? `, ${updated} mis à jour` : "")
        );
      }
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de la synchronisation");
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void handleSync()}
      disabled={loading || done}
      className="rounded-lg border-border/60 gap-1.5"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : done ? (
        <Check className="h-3.5 w-3.5 text-[var(--color-status-positive)]" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {done ? "Synchronisé" : "Sync locataires"}
    </Button>
  );
}
