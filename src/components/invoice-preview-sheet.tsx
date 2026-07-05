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
 * Aperçu PDF via un endpoint server-side (/api/invoices/preview-pdf) — le PDF
 * est rendu par renderToBuffer (Node), stocké 5 min en cache et servi depuis
 * une URL same-origin, ce qui permet un affichage iframe fiable là où le blob
 * URL client-side échouait (Chrome bloque le rendu de PDF blob avec la CSP
 * stricte + @react-pdf/renderer client-side nécessite WebAssembly + 'unsafe-
 * eval' selon les navigateurs).
 */
export function InvoicePreviewSheet({
  open,
  onOpenChange,
  preview,
  onConfirm,
  confirmLabel = "Confirmer et générer",
  isConfirming = false,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl(null);

    (async () => {
      try {
        const postRes = await fetch("/api/invoices/preview-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preview.pdfData),
        });
        if (!postRes.ok) {
          const text = await postRes.text();
          throw new Error(`POST ${postRes.status} — ${text || "erreur"}`);
        }
        const { token } = (await postRes.json()) as { token: string };
        if (cancelled) return;

        // Sanity check : on récupère le PDF nous-même pour être sûr que
        // l'iframe pourra le charger. Si erreur (token expiré, render échoué,
        // extension navigateur…), on affiche le message plutôt qu'un iframe
        // Chrome « Ce contenu est bloqué ».
        const getRes = await fetch(`/api/invoices/preview-pdf?token=${token}`);
        if (!getRes.ok) {
          const text = await getRes.text();
          throw new Error(`GET ${getRes.status} — ${text || "erreur"}`);
        }
        const contentType = getRes.headers.get("content-type") ?? "";
        if (!contentType.includes("pdf")) {
          throw new Error(`Réponse inattendue : ${contentType || "type inconnu"}`);
        }
        if (cancelled) return;
        setPdfUrl(`/api/invoices/preview-pdf?token=${token}`);
      } catch (err) {
        if (cancelled) return;
        console.error("[InvoicePreviewSheet] erreur d'aperçu", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
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
          {!loading && !error && pdfUrl && (
            <iframe
              src={pdfUrl}
              title="Aperçu de la facture"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
