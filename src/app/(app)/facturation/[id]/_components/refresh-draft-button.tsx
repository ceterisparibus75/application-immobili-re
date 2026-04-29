"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshDraftInvoice } from "@/actions/invoice";

interface Props {
  invoiceId: string;
  societyId: string;
}

export function RefreshDraftButton({ invoiceId, societyId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRefresh() {
    setLoading(true);
    try {
      const result = await refreshDraftInvoice(societyId, invoiceId);
      if (result.success) {
        toast.success("Brouillon actualisé avec les paramètres du bail");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de l'actualisation");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      Actualiser
    </Button>
  );
}
