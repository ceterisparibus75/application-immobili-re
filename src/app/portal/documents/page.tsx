import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Receipt, FolderOpen } from "lucide-react";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon", VALIDEE: "Validée", ENVOYEE: "Envoyée",
  EN_ATTENTE: "En attente", PAYE: "Payé", PARTIELLEMENT_PAYE: "Partiel",
  EN_RETARD: "En retard", RELANCEE: "Relancée", LITIGIEUX: "Litigieux",
  IRRECOUVRABLE: "Irrécouvrable", ANNULEE: "Annulée",
};

const STATUS_VARIANTS: Record<string, "success" | "warning" | "destructive" | "secondary" | "default" | "outline"> = {
  BROUILLON: "outline", VALIDEE: "secondary", ENVOYEE: "default",
  EN_ATTENTE: "warning", PAYE: "success", PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive", RELANCEE: "destructive", LITIGIEUX: "destructive",
  IRRECOUVRABLE: "secondary", ANNULEE: "outline",
};

export default async function PortalDocumentsPage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

  // 1. D'abord les baux du locataire (source de vérité)
  const leases = await prisma.lease.findMany({
    where: { tenantId: session.tenantId },
    select: {
      id: true,
      leaseType: true,
      status: true,
      startDate: true,
      leaseFileUrl: true,
      lot: {
        select: {
          number: true,
          building: { select: { name: true, city: true } },
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // 2. Liste des IDs de baux vérifiés (appartiennent à ce locataire)
  const ownLeaseIds = leases.map((l) => l.id);

  // 3. Documents GED — uniquement ceux liés à CE locataire ou à SES baux
  //    (jamais aux baux d'autres locataires du même immeuble)
  const gedDocuments = await prisma.document.findMany({
    where: {
      OR: [
        { tenantId: session.tenantId },
        ...(ownLeaseIds.length > 0 ? [{ leaseId: { in: ownLeaseIds } }] : []),
      ],
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      category: true,
      description: true,
      createdAt: true,
      leaseId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const invoices = await prisma.invoice.findMany({
    where: { tenantId: session.tenantId },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      status: true,
      totalHT: true,
      totalTTC: true,
      issueDate: true,
      dueDate: true,
      fileUrl: true,
      payments: { select: { paidAt: true }, take: 1, orderBy: { paidAt: "desc" } },
    },
    orderBy: { issueDate: "desc" },
    take: 100,
  });

  const appelLoyer = invoices.filter((i) => i.invoiceType === "APPEL_LOYER");
  const quittances = invoices.filter((i) => i.invoiceType === "QUITTANCE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes documents</h1>
        <p className="text-muted-foreground">
          Consultez vos baux, factures et quittances
        </p>
      </div>

      {/* Baux */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Baux ({leases.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun bail</p>
          ) : (
            <div className="divide-y">
              {leases.map((lease) => (
                <div key={lease.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {lease.lot.building.name} — Lot {lease.lot.number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Depuis le {formatDate(lease.startDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={lease.status === "EN_COURS" ? "success" : "secondary"}>
                      {lease.status === "EN_COURS" ? "Actif" : lease.status}
                    </Badge>
                    {/* Bail uploadé via l'outil dédié */}
                    {lease.leaseFileUrl && (
                      <a href={lease.leaseFileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <Download className="h-4 w-4" />
                        Bail
                      </a>
                    )}
                    {/* Documents GED liés à ce bail */}
                    {gedDocuments
                      .filter((d) => d.leaseId === lease.id)
                      .map((doc) => (
                        <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <Download className="h-4 w-4" />
                          {doc.description ?? doc.fileName}
                        </a>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Autres documents (GED sans bail associé) */}
      {gedDocuments.filter((d) => !d.leaseId).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4" />
              Documents ({gedDocuments.filter((d) => !d.leaseId).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {gedDocuments.filter((d) => !d.leaseId).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{doc.description ?? doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                  </div>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 text-primary hover:text-primary/80" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appels de loyer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Appels de loyer ({appelLoyer.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appelLoyer.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun appel de loyer</p>
          ) : (
            <div className="divide-y">
              {appelLoyer.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Émise le {formatDate(inv.issueDate)} — Échéance {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(inv.totalTTC ?? inv.totalHT)}
                    </span>
                    <Badge variant={STATUS_VARIANTS[inv.status] ?? "default"}>
                      {STATUS_LABELS[inv.status] ?? inv.status}
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
        </CardContent>
      </Card>

      {/* Quittances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Quittances ({quittances.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quittances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune quittance</p>
          ) : (
            <div className="divide-y">
              {quittances.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.payments?.[0]?.paidAt ? `Payé le ${formatDate(inv.payments[0].paidAt)}` : formatDate(inv.issueDate)}
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
        </CardContent>
      </Card>
    </div>
  );
}
