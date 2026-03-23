"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { sendInvoiceToTenant } from "@/actions/invoice";
import { toast } from "sonner";

type Props = {
  invoiceId: string;
  societyId: string;
};

export function SendInvoiceButton({ invoiceId, societyId }: Props) {
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    const result = await sendInvoiceToTenant(societyId, invoiceId);
    if (result.success) {
      toast.success("Facture envoyée par email au locataire");
    } else {
      toast.error(result.error ?? "Erreur lors de l'envoi");
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
