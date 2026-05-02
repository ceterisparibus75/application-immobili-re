"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck, Loader2 } from "lucide-react";

import { validateJournalEntries } from "@/actions/accounting";
import { Button } from "@/components/ui/button";

export function ValidateDraftJournalEntriesButton({
  societyId,
  entryIds,
}: {
  societyId: string;
  entryIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleValidate() {
    startTransition(async () => {
      const result = await validateJournalEntries(societyId, entryIds);
      if (result.success) {
        toast.success(`${result.data?.validated ?? 0} écriture(s) validée(s)`);
        router.refresh();
        return;
      }
      toast.error(result.error ?? "Erreur lors de la validation");
    });
  }

  return (
    <Button size="sm" onClick={handleValidate} disabled={isPending || entryIds.length === 0}>
      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
      Valider affichées
    </Button>
  );
}
