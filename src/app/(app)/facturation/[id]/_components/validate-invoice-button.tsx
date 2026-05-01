"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateInvoice } from "@/actions/invoice";

interface Props {
  invoiceId: string;
  societyId: string;
}

export function ValidateInvoiceButton({ invoiceId, societyId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleValidate() {
    setLoading(true);
    try {
      const result = await validateInvoice(societyId, invoiceId);
      if (result.success) {
        toast.success("Facture validée — un numéro lui a été attribué");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la validation");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleValidate} disabled={loading} size="sm">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      {loading ? "Validation…" : "Valider"}
    </Button>
  );
}