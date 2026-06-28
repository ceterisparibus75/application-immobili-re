"use client";

import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetClose, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, Zap } from "lucide-react";
import type { InvoicePreview } from "@/actions/invoice";

// Composant rendu via react-pdf — chargé côté client uniquement pour éviter
// l'import lourd côté serveur et éviter les erreurs de SSR sur les libs PDF.
const PdfRender = dynamic(
  () =>
    Promise.all([import("@react-pdf/renderer"), import("@/lib/invoice-pdf")]).then(
      ([pdf, invoice]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const InvoicePdf = invoice.InvoicePdf as React.ComponentType<{ data: any }>;
        const PDFViewer = pdf.PDFViewer as React.ComponentType<{
          width: string | number;
          height: string | number;
          showToolbar?: boolean;
          children: React.ReactNode;
        }>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Wrapper = ({ data }: { data: any }) => (
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            <InvoicePdf data={data} />
          </PDFViewer>
        );
        Wrapper.displayName = "InvoicePreviewPdfRender";
        return Wrapper;
      },
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Chargement de l&apos;aperçu PDF…
      </div>
    ),
  },
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: InvoicePreview;
  onConfirm?: () => void;
  confirmLabel?: string;
  isConfirming?: boolean;
};

export function InvoicePreviewSheet({
  open,
  onOpenChange,
  preview,
  onConfirm,
  confirmLabel = "Confirmer et générer",
  isConfirming = false,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        {/* Barre d'actions */}
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

        {/* Doublon */}
        {preview.alreadyExists && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Une facture existe déjà pour ce bail sur cette période.
          </div>
        )}

        {/* Rendu canonique : on utilise le MÊME composant InvoicePdf que la
            facture finale, alimenté par le pdfData construit côté serveur dans
            computeInvoicePreview. Plus de divergence possible entre l'aperçu
            et la facture émise. */}
        <div className="flex-1 min-h-0">
          <PdfRender data={preview.pdfData} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
