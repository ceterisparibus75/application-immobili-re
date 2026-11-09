"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateQuittanceForPaidInvoice } from "@/actions/invoice";

export function GenerateQuittanceButton({
  invoiceId,
  societyId,
}: {
  invoiceId: string;
  societyId: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerate(): Promise<void> {
    setIsLoading(true);
    const result = await generateQuittanceForPaidInvoice(societyId, invoiceId);
    setIsLoading(false);
    if (result.success && result.data) {
      toast.success("Quittance générée et envoyée au locataire");
      router.push(`/facturation/${result.data.quittanceId}`);
    } else {
      toast.error(result.error ?? "Erreur lors de la génération de la quittance");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isLoading}>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
      Générer la quittance
    </Button>
  );
}
