"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTenant } from "@/actions/tenant";
import { Button } from "@/components/ui/button";
import { useSociety } from "@/providers/society-provider";
import { Loader2, Trash2 } from "lucide-react";

export function DeleteTenantButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    if (!activeSociety) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce locataire ? Cette action est irréversible.")) return;

    setError("");
    startTransition(async () => {
      const result = await deleteTenant(activeSociety.id, tenantId);
      if (result.success) {
        router.push("/locataires");
      } else {
        setError(result.error ?? "Erreur");
      }
    });
  }

  return (
    <div>
      <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Supprimer
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
