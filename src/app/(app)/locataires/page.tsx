import { getTenants } from "@/actions/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, FileText, Plus, User, Users } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { RiskIndicator, TenantEntityType } from "@/generated/prisma/client";

export const metadata = { title: "Locataires" };

const RISK_VARIANTS: Record<RiskIndicator, "success" | "warning" | "destructive"> = {
  VERT: "success",
  ORANGE: "warning",
  ROUGE: "destructive",
};

function tenantName(tenant: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? "—")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";
}

export default async function LocatairesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) {
    redirect("/societes");
  }

  const tenants = await getTenants(societyId);
  const active = tenants.filter((t) => t.isActive);
  const inactive = tenants.filter((t) => !t.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locataires</h1>
          <p className="text-muted-foreground">
            {active.length} locataire{active.length !== 1 ? "s" : ""} actif
            {active.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/locataires/nouveau">
          <Button>
            <Plus className="h-4 w-4" />
            Nouveau locataire
          </Button>
        </Link>
      </div>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun locataire</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Créez votre premier dossier locataire pour préparer un bail.
            </p>
            <Link href="/locataires/nouveau">
              <Button>
                <Plus className="h-4 w-4" />
                Créer un locataire
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Actifs */}
          <Card>
            <CardHeader>
              <CardTitle>Locataires actifs ({active.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun locataire actif
                </p>
              ) : (
                <div className="divide-y">
                  {active.map((tenant) => (
                    <Link
                      key={tenant.id}
                      href={`/locataires/${tenant.id}`}
                      className="flex items-center justify-between py-3 px-2 hover:bg-accent/50 rounded-md transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {tenant.entityType === "PERSONNE_MORALE" ? (
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {tenantName(tenant)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tenant.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          {tenant._count.leases} bail
                          {tenant._count.leases !== 1 ? "x" : ""}
                        </span>
                        <Badge variant="outline">
                          {tenant.entityType === "PERSONNE_MORALE"
                            ? "Société"
                            : "Particulier"}
                        </Badge>
                        <Badge variant={RISK_VARIANTS[tenant.riskIndicator]}>
                          {tenant.riskIndicator}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inactifs */}
          {inactive.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  Anciens locataires ({inactive.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {inactive.map((tenant) => (
                    <Link
                      key={tenant.id}
                      href={`/locataires/${tenant.id}`}
                      className="flex items-center justify-between py-3 px-2 hover:bg-accent/50 rounded-md transition-colors opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        {tenant.entityType === "PERSONNE_MORALE" ? (
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {tenantName(tenant)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tenant.email}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Inactif</Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
