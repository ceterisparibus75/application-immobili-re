"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { settleAvoir } from "@/actions/invoice";

export function SettleAvoirButton({
  invoiceId,
  societyId,
}: {
  invoiceId: string;
  societyId: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSettle() {
    setIsLoading(true);
    const result = await settleAvoir(societyId, invoiceId);
    setIsLoading(false);
    if (result.success) {
      toast.success("Avoir solde");
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSettle} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCheck className="h-4 w-4" />
      )}
      Solder l&apos;avoir
    </Button>
  );
}
