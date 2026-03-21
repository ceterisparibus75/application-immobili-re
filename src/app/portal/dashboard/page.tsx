import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Shield, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PortalDashboardPage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    include: {
      leases: {
        where: { status: "EN_COURS" },
        include: {
          lot: {
            include: {
              building: { select: { name: true, addressLine1: true, city: true } },
            },
          },
        },
      },
      invoices: {
        where: { status: { in: ["EN_ATTENTE", "EN_RETARD"] } },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
    },
  });

  if (!tenant) redirect("/portal/login");

  const tenantName =
    tenant.entityType === "PERSONNE_MORALE"
      ? (tenant.companyName ?? "Locataire")
      : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "Locataire";

  const activeLease = tenant.leases[0];
  const unpaidInvoices = tenant.invoices;
  const hasInsurance = !!tenant.insuranceUploadedAt;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bonjour, {tenantName}
        </h1>
        <p className="text-muted-foreground">
          Bienvenue dans votre espace locataire
        </p>
      </div>

      {/* Alertes */}
      {!hasInsurance && (
        <div className="rounded-md border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-900/20 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Attestation d'assurance manquante
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400">
                Merci de déposer votre attestation d'assurance dans la rubrique{" "}
                <Link href="/portal/assurance" className="underline font-medium">
                  Assurance
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {unpaidInvoices.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {unpaidInvoices.length} facture{unpaidInvoices.length > 1 ? "s" : ""} en attente de règlement
              </p>
              <Link href="/portal/documents" className="text-xs text-red-700 dark:text-red-400 underline">
                Voir les factures
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Bail actif */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Mon bail
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeLease ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">
                    {activeLease.lot.building.name} — Lot {activeLease.lot.number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeLease.lot.building.addressLine1}, {activeLease.lot.building.city}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Loyer mensuel</p>
                    <p className="text-sm font-medium">{formatCurrency(activeLease.currentRentHT)} HT</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Début du bail</p>
                    <p className="text-sm font-medium">{formatDate(activeLease.startDate)}</p>
                  </div>
                </div>
                {activeLease.leaseFileUrl && (
                  <a
                    href={activeLease.leaseFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Télécharger le bail
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun bail actif</p>
            )}
          </CardContent>
        </Card>

        {/* Assurance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Assurance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasInsurance ? (
              <div className="space-y-2">
                <Badge variant="success">Attestation déposée</Badge>
                <p className="text-xs text-muted-foreground">
                  Déposée le {formatDate(tenant.insuranceUploadedAt!)}
                </p>
                {tenant.insuranceExpiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Expire le {formatDate(tenant.insuranceExpiresAt)}
                  </p>
                )}
                <Link href="/portal/assurance" className="text-sm text-primary hover:underline">
                  Mettre à jour
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="warning">Non fournie</Badge>
                <p className="text-xs text-muted-foreground">
                  Veuillez déposer votre attestation d'assurance
                </p>
                <Link
                  href="/portal/assurance"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                >
                  Déposer maintenant
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
