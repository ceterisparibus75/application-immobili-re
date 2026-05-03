"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendChargeRegularization } from "@/actions/charge-statement";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface SendStatementButtonProps {
  societyId: string;
  regularizationId: string;
  tenantEmail: string;
  disabled?: boolean;
}

export function SendStatementButton({
  societyId,
  regularizationId,
  tenantEmail,
  disabled,
}: SendStatementButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setLoading(true);
    try {
      const result = await sendChargeRegularization(societyId, regularizationId);
      if (result.success) {
        setSent(true);
        toast.success(`Décompte envoyé à ${tenantEmail}`);
      } else {
        toast.error(result.error ?? "Erreur lors de l'envoi");
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-[var(--color-status-positive)]">
        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
        Envoyé
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={loading || disabled}
      title={`Envoyer le décompte à ${tenantEmail}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5 mr-1" />
      )}
      Envoyer
    </Button>
  );
}
