"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import { convertCandidateToTenant } from "@/actions/candidate";
import { Button } from "@/components/ui/button";

type CandidateActionsProps = {
  societyId: string;
  candidateId: string;
  canConvert: boolean;
  disabledReason?: string;
};

export function CandidateActions({
  societyId,
  candidateId,
  canConvert,
  disabledReason,
}: CandidateActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConvert() {
    startTransition(async () => {
      const result = await convertCandidateToTenant(societyId, candidateId);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Conversion impossible");
        return;
      }

      toast.success("Locataire créé depuis la candidature");
      router.push(`/locataires/${result.data.tenantId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleConvert}
        disabled={!canConvert || isPending}
        className="w-full gap-2 bg-brand-gradient-soft text-white hover:opacity-90"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Créer le locataire
        {!isPending && <ArrowRight className="h-4 w-4" />}
      </Button>
      {!canConvert && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  );
}
