import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Shield, AlertTriangle, UserCheck } from "lucide-react";
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

  // Trouver TOUS les locataires avec cet email (multi-société)
  const tenants = await prisma.tenant.findMany({
    where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
    include: {
      leases: {
        where: { status: "EN_COURS" },
        include: {
          lot: {
            include: {
              building: { select: { name: true, addressLine1: true, city: true } },
            },
          },
          society: { select: { name: true } },
          managingContact: {
            select: { name: true, company: true, email: true, phone: true },
          },
        },
      },
    },
  });

  if (tenants.length === 0) redirect("/portal/login");

  // Agréger les IDs de tous les tenants
  const tenantIds = tenants.map((t) => t.id);

  // Récupérer les factures impayées de tous les tenants
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId: { in: tenantIds }, status: { in: ["EN_ATTENTE", "EN_RETARD"] } },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  // Nom d'affichage (premier locataire trouvé)
  const firstTenant = tenants[0];
  const tenantName =
    firstTenant.entityType === "PERSONNE_MORALE"
      ? (firstTenant.companyName ?? "Locataire")
      : `${firstTenant.firstName ?? ""} ${firstTenant.lastName ?? ""}`.trim() || "Locataire";

  // Agréger tous les baux actifs
  const allLeases = tenants.flatMap((t) => t.leases);
  const hasInsurance = tenants.some((t) => !!t.insuranceUploadedAt);

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
                Attestation d&apos;assurance manquante
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400">
                Merci de d&eacute;poser votre attestation d&apos;assurance dans la rubrique{" "}
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
                {unpaidInvoices.length} facture{unpaidInvoices.length > 1 ? "s" : ""} en attente de r&egrave;glement
              </p>
              <Link href="/portal/documents" className="text-xs text-red-700 dark:text-red-400 underline">
                Voir les factures
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Baux actifs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Mes baux ({allLeases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allLeases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun bail actif</p>
            ) : (
              <div className="space-y-4">
                {allLeases.map((lease) => (
                  <div key={lease.id} className="space-y-1">
                    <p className="text-sm font-medium">
                      {lease.lot.building.name} &mdash; Lot {lease.lot.number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lease.lot.building.addressLine1}, {lease.lot.building.city}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <div>
                        <p className="text-xs text-muted-foreground">Loyer mensuel</p>
                        <p className="text-sm font-medium">{formatCurrency(lease.currentRentHT)} HT</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">D&eacute;but du bail</p>
                        <p className="text-sm font-medium">{formatDate(lease.startDate)}</p>
                      </div>
                    </div>
                    {lease.society && (
                      <Badge variant="outline" className="text-xs mt-1">{lease.society.name}</Badge>
                    )}
                    {lease.isThirdPartyManaged && lease.managingContact && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2 rounded text-xs mt-2">
                        <div className="flex items-center gap-1.5 font-medium text-blue-800 dark:text-blue-300">
                          <UserCheck className="h-3.5 w-3.5" />
                          G&eacute;r&eacute; par : {lease.managingContact.company ?? lease.managingContact.name}
                        </div>
                        {(lease.managingContact.phone || lease.managingContact.email) && (
                          <div className="mt-1 text-blue-700 dark:text-blue-400 space-y-0.5">
                            {lease.managingContact.phone && (
                              <p>T&eacute;l : {lease.managingContact.phone}</p>
                            )}
                            {lease.managingContact.email && (
                              <p>Email : {lease.managingContact.email}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {lease.leaseFileUrl && (
                      <a
                        href={lease.leaseFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        T&eacute;l&eacute;charger le bail
                      </a>
                    )}
                  </div>
                ))}
              </div>
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
                <Badge variant="success">Attestation d&eacute;pos&eacute;e</Badge>
                <Link href="/portal/assurance" className="text-sm text-primary hover:underline">
                  Mettre &agrave; jour
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="warning">Non fournie</Badge>
                <p className="text-xs text-muted-foreground">
                  Veuillez d&eacute;poser votre attestation d&apos;assurance
                </p>
                <Link
                  href="/portal/assurance"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                >
                  D&eacute;poser maintenant
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
