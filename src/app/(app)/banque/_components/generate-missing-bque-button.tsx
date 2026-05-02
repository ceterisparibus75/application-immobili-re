"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { generateMissingBankJournalEntries } from "@/actions/bank-reconciliation";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

type GenerateMissingBqueButtonProps = {
  societyId: string;
  bankAccountId?: string;
  missingCount: number;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
};

export function GenerateMissingBqueButton({
  societyId,
  bankAccountId,
  missingCount,
  size = "default",
  variant = "default",
}: GenerateMissingBqueButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const disabled = pending || missingCount === 0;

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateMissingBankJournalEntries(societyId, bankAccountId);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Erreur lors de la génération des écritures BQUE");
        return;
      }

      if (result.data.generated === 0) {
        toast.info("Aucune écriture BQUE à générer", {
          description: `${result.data.skipped} transaction(s) ignorée(s).`,
        });
      } else {
        toast.success(`${result.data.generated} écriture(s) BQUE générée(s)`, {
          description:
            result.data.skipped > 0
              ? `${result.data.skipped} transaction(s) ignorée(s).`
              : "Le contrôle comptable a été actualisé.",
        });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className="gap-1.5"
      disabled={disabled}
      onClick={handleGenerate}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      {pending ? "Génération..." : "Générer BQUE"}
    </Button>
  );
}
