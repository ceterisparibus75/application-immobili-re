"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { duplicateInvoiceAsDraft } from "@/actions/invoice";

interface Props {
  invoiceId: string;
  societyId: string;
}

export function DuplicateInvoiceButton({ invoiceId, societyId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDuplicate() {
    setLoading(true);
    try {
      const result = await duplicateInvoiceAsDraft(societyId, invoiceId);
      if (result.success && result.data) {
        toast.success("Brouillon créé — vous pouvez le modifier avant validation");
        router.push(`/facturation/${result.data.id}`);
      } else {
        toast.error(result.error ?? "Erreur lors de la duplication");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={loading} title="Créer un brouillon identique à cette facture">
      <Copy className="h-4 w-4" />
      {loading ? "Duplication…" : "Dupliquer"}
    </Button>
  );
}