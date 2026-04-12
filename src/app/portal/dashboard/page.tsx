import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, Shield, AlertTriangle, UserCheck, Clock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TimelineSection } from "./timeline-section";

export default async function PortalDashboardPage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

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

  const tenantIds = tenants.map((t: { id: string }) => t.id);

  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId: { in: tenantIds }, status: { in: ["EN_ATTENTE", "EN_RETARD"] } },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  const firstTenant = tenants[0];
  const tenantName =
    firstTenant.entityType === "PERSONNE_MORALE"
      ? (firstTenant.companyName ?? "Locataire")
      : `${firstTenant.firstName ?? ""} ${firstTenant.lastName ?? ""}`.trim() || "Locataire";

  const allLeases = tenants.flatMap((t: typeof tenants[number]) => t.leases);
  const hasInsurance = tenants.some((t: typeof tenants[number]) => !!t.insuranceUploadedAt);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-brand-gradient p-6 sm:p-8 text-white shadow-brand-lg">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Bonjour, {tenantName}
        </h1>
        <p className="text-white/70 mt-1">
          Bienvenue dans votre espace locataire — consultez vos documents et suivez vos démarches.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link
            href="/portal/documents"
            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Mes documents
          </Link>
          <Link
            href="/portal/upload"
            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            Envoyer un document
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {!hasInsurance && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-900/20 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Attestation d&apos;assurance manquante
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400">
                Merci de déposer votre attestation dans la rubrique{" "}
                <Link href="/portal/assurance" className="underline font-medium">
                  Assurance
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {unpaidInvoices.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 p-4 shadow-sm">
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Leases + Insurance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active leases */}
          <Card className="shadow-brand">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-[var(--color-brand-blue)]" />
                Mes baux ({allLeases.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allLeases.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun bail actif</p>
              ) : (
                <div className="space-y-4">
                  {allLeases.map((lease: typeof allLeases[number]) => (
                    <div key={lease.id} className="rounded-lg border p-4 hover:shadow-sm transition-shadow">
                      <p className="text-sm font-semibold text-[var(--color-brand-deep)]">
                        {lease.lot.building.name} — Lot {lease.lot.number}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lease.lot.building.addressLine1}, {lease.lot.building.city}
                      </p>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Loyer mensuel</p>
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(lease.currentRentHT)} HT</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Début du bail</p>
                          <p className="text-sm font-medium">{formatDate(lease.startDate)}</p>
                        </div>
                      </div>
                      {lease.society && (
                        <Badge variant="outline" className="text-xs mt-2">{lease.society.name}</Badge>
                      )}
                      {lease.isThirdPartyManaged && lease.managingContact && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2.5 rounded-lg text-xs mt-3">
                          <div className="flex items-center gap-1.5 font-medium text-blue-800 dark:text-blue-300">
                            <UserCheck className="h-3.5 w-3.5" />
                            Géré par : {lease.managingContact.company ?? lease.managingContact.name}
                          </div>
                          {(lease.managingContact.phone || lease.managingContact.email) && (
                            <div className="mt-1 text-blue-700 dark:text-blue-400 space-y-0.5">
                              {lease.managingContact.phone && <p>Tél : {lease.managingContact.phone}</p>}
                              {lease.managingContact.email && <p>Email : {lease.managingContact.email}</p>}
                            </div>
                          )}
                        </div>
                      )}
                      {lease.leaseFileUrl && (
                        <a
                          href={lease.leaseFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Télécharger le bail
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insurance */}
          <Card className="shadow-brand">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-violet-500" />
                Assurance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasInsurance ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Attestation déposée</Badge>
                  </div>
                  <Link href="/portal/assurance" className="text-sm text-primary hover:underline">
                    Mettre à jour
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="warning">Non fournie</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Veuillez déposer votre attestation
                    </p>
                  </div>
                  <Link
                    href="/portal/upload"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                  >
                    Déposer maintenant
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Timeline */}
        <div>
          <Card className="shadow-brand">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-[var(--color-brand-cyan)]" />
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineSection />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
