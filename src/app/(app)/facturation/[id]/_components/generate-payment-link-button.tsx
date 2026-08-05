"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, CreditCard, ExternalLink, Loader2, Check } from "lucide-react";
import { createInvoicePaymentLink } from "@/actions/tenant-payment";

interface Props {
  societyId: string;
  invoiceId: string;
  initialUrl: string | null;
  disabled?: boolean;
  disabledReason?: string;
}

export function GeneratePaymentLinkButton({
  societyId,
  invoiceId,
  initialUrl,
  disabled,
  disabledReason,
}: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const res = await createInvoicePaymentLink(societyId, invoiceId);
      if (res.success && res.data?.url) {
        setUrl(res.data.url);
        toast.success("Lien de paiement généré");
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Impossible de copier");
    }
  }

  if (url) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir le lien
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copié !" : "Copier"}
        </Button>
      </div>
    );
  }

  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled title={disabledReason}>
        <CreditCard className="h-3.5 w-3.5" />
        Lien de paiement
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending}>
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
      Générer un lien de paiement
    </Button>
  );
}
