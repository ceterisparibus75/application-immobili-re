"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

import { validateJournalEntry } from "@/actions/accounting";
import { Button } from "@/components/ui/button";

export function ValidateJournalEntryButton({
  societyId,
  entryId,
}: {
  societyId: string;
  entryId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleValidate() {
    startTransition(async () => {
      const result = await validateJournalEntry(societyId, entryId);
      if (result.success) {
        toast.success("Écriture validée");
        router.refresh();
        return;
      }
      toast.error(result.error ?? "Erreur lors de la validation");
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleValidate} disabled={isPending}>
      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
      Valider
    </Button>
  );
}
