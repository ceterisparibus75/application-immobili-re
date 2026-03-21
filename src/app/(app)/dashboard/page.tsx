import { getDashboardStats } from "@/actions/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Building2,
  Euro,
  FileText,
  Home,
  Receipt,
  Users,
} from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { TenantEntityType } from "@prisma/client";

function tenantName(t: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Créé",
  UPDATE: "Modifié",
  DELETE: "Supprimé",
};

const ENTITY_LABELS: Record<string, string> = {
  Building: "Immeuble",
  Lot: "Lot",
  Tenant: "Locataire",
  Lease: "Bail",
  Invoice: "Facture",
  Charge: "Charge",
  BankAccount: "Compte bancaire",
  BankTransaction: "Transaction",
  ChargeCategory: "Catégorie de charge",
};

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const stats = await getDashboardStats(societyId);

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Impossible de charger le tableau de bord.
      </div>
    );
  }

  const hasAlerts =
    stats.expiringLeases.length > 0 ||
    stats.expiringDiagnostics.length > 0 ||
    stats.overdueInvoiceCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de votre patrimoine</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/patrimoine/immeubles">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Immeubles</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.buildingCount}</p>
              <p className="text-xs text-muted-foreground">
                {stats.lotCount} lots —{" "}
                <span className="text-amber-600">{stats.vacantLotCount} vacants</span>
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/baux">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Baux actifs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.activeLeaseCount}</p>
              <p className="text-xs text-muted-foreground">Baux en cours</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/locataires">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Locataires</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.tenantCount}</p>
              <p className="text-xs text-muted-foreground">Locataires actifs</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/facturation">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ce mois</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {stats.monthRevenueTTC.toLocaleString("fr-FR", {
                  maximumFractionDigits: 0,
                })}{" "}
                €
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.monthInvoiceCount} facture
                {stats.monthInvoiceCount !== 1 ? "s" : ""} TTC
                {stats.overdueInvoiceCount > 0 && (
                  <span className="ml-1 text-destructive font-medium">
                    · {stats.overdueInvoiceCount} en retard
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alertes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertes
            </CardTitle>
            <CardDescription>Échéances et actions requises</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasAlerts ? (
              <p className="text-sm text-muted-foreground">
                Aucune alerte pour le moment.
              </p>
            ) : (
              <>
                {/* Baux expirant */}
                {stats.expiringLeases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Baux expirant dans 90 jours
                    </p>
                    {stats.expiringLeases.map((lease) => {
                      const daysLeft = Math.ceil(
                        (new Date(lease.endDate).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      );
                      return (
                        <Link
                          key={lease.id}
                          href={`/baux/${lease.id}`}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {tenantName(lease.tenant)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lease.lot.building.name} — Lot {lease.lot.number}
                            </p>
                          </div>
                          <Badge
                            variant={daysLeft <= 30 ? "destructive" : "warning"}
                          >
                            J-{daysLeft}
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Diagnostics expirant */}
                {stats.expiringDiagnostics.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Diagnostics expirant
                    </p>
                    {stats.expiringDiagnostics.map((diag) => {
                      const daysLeft = diag.expiresAt
                        ? Math.ceil(
                            (new Date(diag.expiresAt).getTime() - Date.now()) /
                              (1000 * 60 * 60 * 24)
                          )
                        : null;
                      return (
                        <Link
                          key={diag.id}
                          href={`/patrimoine/immeubles/${diag.building.id}`}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">{diag.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {diag.building.name}
                            </p>
                          </div>
                          {daysLeft !== null && (
                            <Badge
                              variant={daysLeft <= 0 ? "destructive" : daysLeft <= 30 ? "destructive" : "warning"}
                            >
                              {daysLeft <= 0 ? "Expiré" : `J-${daysLeft}`}
                            </Badge>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Factures en retard */}
                {stats.overdueInvoiceCount > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Factures en retard
                    </p>
                    <Link
                      href="/facturation"
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors"
                    >
                      <Receipt className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-medium text-destructive">
                        {stats.overdueInvoiceCount} facture
                        {stats.overdueInvoiceCount !== 1 ? "s" : ""} en retard
                      </p>
                    </Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Activité récente */}
        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>Dernières actions dans la société</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentAuditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune activité enregistrée.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                      <Home className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>{" "}
                        {ENTITY_LABELS[log.entity] ?? log.entity}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.user?.name ?? "Système"} —{" "}
                        {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
