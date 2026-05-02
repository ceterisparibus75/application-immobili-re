"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { postFixedAssetDepreciation } from "@/actions/fixed-asset";
import { Calculator, Loader2 } from "lucide-react";

type PostDepreciationButtonProps = {
  societyId: string;
  fixedAssetId: string;
  fiscalYear: number;
};

export function PostDepreciationButton({
  societyId,
  fixedAssetId,
  fiscalYear,
}: PostDepreciationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await postFixedAssetDepreciation(societyId, { fixedAssetId, fiscalYear });
      if (result.success) {
        toast.success(`Dotation ${fiscalYear} générée en brouillon`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la génération");
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
      Générer
    </Button>
  );
}
