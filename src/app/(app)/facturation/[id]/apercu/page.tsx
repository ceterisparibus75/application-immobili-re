import { getInvoiceById } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function FactureApercuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const invoice = await getInvoiceById(societyId, id);
  if (!invoice) notFound();

  const pdfUrl = `/api/invoices/${id}/pdf`;
  const pdfViewerUrl = `${pdfUrl}?preview=1#toolbar=1&navpanes=0&view=FitH`;
  const invoiceLabel = invoice.invoiceNumber ?? "Prévisualisation";
  const canExportPdf = Boolean(invoice.invoiceNumber);

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/facturation/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Aperçu PDF</h1>
            <p className="text-sm text-muted-foreground">
              {invoiceLabel}
            </p>
          </div>
        </div>
        {canExportPdf && (
          <div className="flex items-center gap-2">
            <a href={pdfUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" />
                Ouvrir
              </Button>
            </a>
            <a href={pdfUrl} download>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
            </a>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-white">
        <object
          data={pdfViewerUrl}
          type="application/pdf"
          className="h-full min-h-[calc(100vh-15rem)] w-full"
        >
          {/* Fallback quand Chrome/extension refuse d'embarquer le PDF */}
          <div className="flex h-full min-h-[calc(100vh-15rem)] flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-muted-foreground max-w-md">
              Votre navigateur bloque l&apos;affichage du PDF ici (extension ou
              lecteur PDF Chrome désactivé). Utilisez l&apos;un des boutons
              ci-dessous pour ouvrir ou télécharger le fichier.
            </p>
            <div className="flex items-center gap-2">
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <Button size="sm">
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir dans un nouvel onglet
                </Button>
              </a>
              <a href={pdfUrl} download>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              </a>
            </div>
          </div>
        </object>
      </div>
    </div>
  );
}
