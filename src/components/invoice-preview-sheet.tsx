"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetClose, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Zap, Loader2 } from "lucide-react";
import type { InvoicePreview } from "@/actions/invoice";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: InvoicePreview;
  onConfirm?: () => void;
  confirmLabel?: string;
  isConfirming?: boolean;
};

/**
 * Génère le blob PDF côté client via @react-pdf/renderer puis l'affiche dans
 * un <iframe>. On ne passe plus par <PDFViewer> qui échouait silencieusement
 * (rendu vide en dark mode quand certains champs de pdfData étaient absents).
 * Ici, toute erreur de rendu est capturée et affichée à l'utilisateur.
 */
export function InvoicePreviewSheet({
  open,
  onOpenChange,
  preview,
  onConfirm,
  confirmLabel = "Confirmer et générer",
  isConfirming = false,
}: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let currentUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    (async () => {
      try {
        const [reactPdf, invoiceModule, React] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/lib/invoice-pdf"),
          import("react"),
        ]);
        const { pdf } = reactPdf;
        const { InvoicePdf } = invoiceModule;
        const element = React.createElement(InvoicePdf, { data: preview.pdfData });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instance = pdf(element as any);
        const blob = await instance.toBlob();
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch (err) {
        if (cancelled) return;
        console.error("[InvoicePreviewSheet] erreur de rendu PDF", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue lors de la génération de l'aperçu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [open, preview.pdfData]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 print:hidden">
          <SheetTitle className="text-base font-semibold">Aperçu de la facture</SheetTitle>
          <div className="flex items-center gap-2">
            {onConfirm && (
              <Button size="sm" onClick={onConfirm} disabled={isConfirming || preview.alreadyExists}>
                <Zap className="h-4 w-4" />
                {isConfirming ? "Génération…" : confirmLabel}
              </Button>
            )}
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </Button>
            </SheetClose>
          </div>
        </div>

        {preview.alreadyExists && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Une facture existe déjà pour ce bail sur cette période.
          </div>
        )}

        <div className="flex-1 min-h-0 bg-white">
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Génération de l&apos;aperçu…
            </div>
          )}
          {error && (
            <div className="p-4">
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Impossible de générer l&apos;aperçu</p>
                  <p className="text-xs opacity-80 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
          {!loading && !error && blobUrl && (
            <iframe
              src={blobUrl}
              title="Aperçu de la facture"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
