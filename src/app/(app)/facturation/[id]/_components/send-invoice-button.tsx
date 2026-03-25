"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";

type Props = {
  invoiceId: string;
  societyId: string;
};

export function SendInvoiceButton({ invoiceId }: Props) {
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send-email`, { method: "POST" });
      const data = await res.json() as { success?: boolean; error?: { message?: string } };
      if (res.ok && data.success) {
        toast.success("Facture envoyée par email au locataire");
      } else {
        toast.error(data.error?.message ?? "Erreur lors de l'envoi");
      }
    } catch {
      toast.error("Erreur lors de l'envoi");
    }
    setSending(false);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSend} disabled={sending}>
      <Send className="h-4 w-4" />
      {sending ? "Envoi…" : "Envoyer au locataire"}
    </Button>
  );
}
