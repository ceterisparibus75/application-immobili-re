"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createValuation } from "@/actions/valuation";
import { toast } from "sonner";

export function CreateValuationButton({
  societyId,
  buildingId,
}: {
  societyId: string;
  buildingId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    startTransition(async () => {
      const result = await createValuation(societyId, { buildingId });
      if (result.success && result.data) {
        toast.success("Avis de valeur créé");
        router.push(`/patrimoine/immeubles/${buildingId}/valorisation/${result.data.id}`);
      } else {
        toast.error(result.error ?? "Erreur lors de la création");
      }
    });
  }

  return (
    <Button onClick={handleCreate} disabled={isPending} className="bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-deep)] text-white">
      <Plus className="h-4 w-4 mr-2" />
      {isPending ? "Création..." : "Nouvel avis de valeur"}
    </Button>
  );
}
