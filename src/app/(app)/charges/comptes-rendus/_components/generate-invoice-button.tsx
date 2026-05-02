"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateInvoiceFromRegularization } from "@/actions/charge-regularization-invoice";
import { useSociety } from "@/providers/society-provider";

interface GenerateInvoiceButtonProps {
  regularizationId: string;
}

export function GenerateInvoiceButton({ regularizationId }: GenerateInvoiceButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { activeSociety } = useSociety();
  const router = useRouter();

  async function handleClick() {
    if (!activeSociety) return;
    setIsLoading(true);
    const result = await generateInvoiceFromRegularization(activeSociety.id, regularizationId);
    setIsLoading(false);
    if (result.success) {
      toast.success("Facture créée", { description: "Brouillon disponible dans Facturation" });
      router.push(`/facturation/${result.data?.invoiceId}`);
    } else {
      toast.error(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileText className="h-3.5 w-3.5" />
      )}
      Facturer
    </Button>
  );
}