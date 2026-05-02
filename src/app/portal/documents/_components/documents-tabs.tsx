"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

function portalInvoiceStatus(status: string): { label: string; variant: "success" | "destructive" } {
  if (status === "PAYE") return { label: "Payé", variant: "success" };
  return { label: "En retard", variant: "destructive" };
}

const CATEGORY_LABELS: Record<string, string> = {
  bail: "Bail", avenant: "Avenant", diagnostic: "Diagnostic",
  assurance: "Assurance", titre_propriete: "Titre de propriété",
  contrat: "Contrat", etat_des_lieux: "État des lieux",
};

type GedDoc = {
  id: string; fileName: string; fileUrl: string;
  category: string | null; description: string | null; createdAt: string;
};

type Lease = {
  id: string; status: string; startDate: string; leaseFileUrl: string | null;
  lotName: string; societyName: string | null; docs: GedDoc[];
};

type Invoice = {
  id: string; invoiceNumber: string | null; status: string;
  totalHT: number; totalTTC: number | null;
  issueDate: string; dueDate: string | null; fileUrl: string | null; paidAt: string | null;
};

type Props = {
  leases: Lease[];
  standaloneGedDocs: GedDoc[];
  appelLoyer: Invoice[];
  quittances: Invoice[];
};

function TabCount({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1 text-[11px] font-medium text-primary">
      {n}
    </span>
  );
}

export default function DocumentsTabs({ leases, standaloneGedDocs, appelLoyer, quittances }: Props) {
  return (
    <Tabs defaultValue="baux">
      <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0 border-b rounded-none pb-0">
        <TabsTrigger value="baux" className="rounded-t-md rounded-b-none border border-b-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
          Baux <TabCount n={leases.length} />
        </TabsTrigger>
        <TabsTrigger value="documents" className="rounded-t-md rounded-b-none border border-b-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
          Documents <TabCount n={standaloneGedDocs.length} />
        </TabsTrigger>
        <TabsTrigger value="appels" className="rounded-t-md rounded-b-none border border-b-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
          Appels de loyer <TabCount n={appelLoyer.length} />
        </TabsTrigger>
        <TabsTrigger value="quittances" className="rounded-t-md rounded-b-none border border-b-0 data-[state=active]:bg-background data-[state=active]:shadow-none">
          Quittances <TabCount n={quittances.length} />
        </TabsTrigger>
      </TabsList>

      {/* Baux */}
      <TabsContent value="baux" className="mt-0 border border-t-0 rounded-b-lg rounded-tr-lg bg-card">
        {leases.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucun bail enregistré.</p>
        ) : (
          <div className="divide-y">
            {leases.map((lease) => {
              const hasDownloads = lease.leaseFileUrl || lease.docs.length > 0;
              return (
                <div key={lease.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{lease.lotName}</p>
                      <Badge variant={lease.status === "EN_COURS" ? "success" : "secondary"} className="shrink-0">
                        {lease.status === "EN_COURS" ? "Actif" : lease.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Depuis le {formatDate(new Date(lease.startDate))}
                      {lease.societyName && <> &middot; {lease.societyName}</>}
                    </p>
                  </div>
                  {hasDownloads && (
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {lease.leaseFileUrl && (
                        <a href={lease.leaseFileUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-accent transition-colors">
                          <Download className="h-3 w-3" />
                          Bail
                        </a>
                      )}
                      {lease.docs.map((doc) => (
                        <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-accent transition-colors">
                          <Download className="h-3 w-3" />
                          {CATEGORY_LABELS[doc.category ?? ""] ?? doc.fileName}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* Documents */}
      <TabsContent value="documents" className="mt-0 border border-t-0 rounded-b-lg rounded-tr-lg bg-card">
        {standaloneGedDocs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucun document disponible.</p>
        ) : (
          <div className="divide-y">
            {standaloneGedDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{doc.description ?? doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(new Date(doc.createdAt))}</p>
                </div>
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 text-primary hover:text-primary/80" />
                </a>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Appels de loyer */}
      <TabsContent value="appels" className="mt-0 border border-t-0 rounded-b-lg rounded-tr-lg bg-card">
        {appelLoyer.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucun appel de loyer.</p>
        ) : (
          <div className="divide-y">
            {appelLoyer.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Émise le {formatDate(new Date(inv.issueDate))}
                    {inv.dueDate && <> — Échéance {formatDate(new Date(inv.dueDate))}</>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(inv.totalTTC ?? inv.totalHT)}
                  </span>
                  <Badge variant={portalInvoiceStatus(inv.status).variant}>
                    {portalInvoiceStatus(inv.status).label}
                  </Badge>
                  {inv.fileUrl && (
                    <a href={`/api/portal/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 text-primary hover:text-primary/80" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Quittances */}
      <TabsContent value="quittances" className="mt-0 border border-t-0 rounded-b-lg rounded-tr-lg bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold text-muted-foreground">
            {quittances.length} quittance{quittances.length !== 1 ? "s" : ""}
          </p>
          {quittances.some((q) => q.fileUrl) && (
            <a
              href="/api/portal/quittances/archive"
              download
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger tout
            </a>
          )}
        </div>
        {quittances.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucune quittance disponible.</p>
        ) : (
          <div className="divide-y">
            {quittances.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.paidAt
                      ? `Payé le ${formatDate(new Date(inv.paidAt))}`
                      : formatDate(new Date(inv.issueDate))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(inv.totalTTC ?? inv.totalHT)}
                  </span>
                  {inv.fileUrl && (
                    <a href={`/api/portal/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 text-primary hover:text-primary/80" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
