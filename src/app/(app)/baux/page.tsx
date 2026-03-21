import { getLeases } from "@/actions/lease";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LeaseStatus, LeaseType, TenantEntityType } from "@prisma/client";

export const metadata = { title: "Baux" };

const STATUS_LABELS: Record<LeaseStatus, string> = {
  EN_COURS: "En cours",
  RESILIE: "Résilié",
  RENOUVELE: "Renouvelé",
  EN_NEGOCIATION: "En négociation",
  CONTENTIEUX: "Contentieux",
};

const STATUS_VARIANTS: Record<
  LeaseStatus,
  "success" | "secondary" | "warning" | "destructive" | "default"
> = {
  EN_COURS: "success",
  RESILIE: "secondary",
  RENOUVELE: "default",
  EN_NEGOCIATION: "warning",
  CONTENTIEUX: "destructive",
};

const TYPE_LABELS: Record<LeaseType, string> = {
  COMMERCIAL_369: "3-6-9",
  DEROGATOIRE: "Dérogatoire",
  PRECAIRE: "Précaire",
};

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

export default async function BauxPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const leases = await getLeases(societyId);

  const actifs = leases.filter((l) => l.status === "EN_COURS");
  const autres = leases.filter((l) => l.status !== "EN_COURS");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Baux commerciaux</h1>
          <p className="text-muted-foreground">
            {actifs.length} bail{actifs.length !== 1 ? "x" : ""} actif
            {actifs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/baux/nouveau">
          <Button>
            <Plus className="h-4 w-4" />
            Nouveau bail
          </Button>
        </Link>
      </div>

      {leases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun bail</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Créez votre premier bail commercial en associant un lot et un
              locataire.
            </p>
            <Link href="/baux/nouveau">
              <Button>
                <Plus className="h-4 w-4" />
                Créer un bail
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Baux actifs */}
          <Card>
            <CardHeader>
              <CardTitle>Baux actifs ({actifs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {actifs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun bail actif
                </p>
              ) : (
                <div className="divide-y">
                  {actifs.map((lease) => (
                    <Link
                      key={lease.id}
                      href={`/baux/${lease.id}`}
                      className="flex items-center justify-between py-3 px-2 hover:bg-accent/50 rounded-md transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {tenantName(lease.tenant)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lease.lot.building.name} — Lot {lease.lot.number},{" "}
                          {lease.lot.building.city}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {lease.currentRentHT.toLocaleString("fr-FR")} € HT/mois
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Depuis le{" "}
                            {new Date(lease.startDate).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {TYPE_LABELS[lease.leaseType]}
                        </Badge>
                        <Badge variant={STATUS_VARIANTS[lease.status]}>
                          {STATUS_LABELS[lease.status]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Autres baux */}
          {autres.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  Baux terminés / autres ({autres.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {autres.map((lease) => (
                    <Link
                      key={lease.id}
                      href={`/baux/${lease.id}`}
                      className="flex items-center justify-between py-3 px-2 hover:bg-accent/50 rounded-md transition-colors opacity-60"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {tenantName(lease.tenant)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lease.lot.building.name} — Lot {lease.lot.number}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {lease.baseRentHT.toLocaleString("fr-FR")} € HT/mois
                        </span>
                        <Badge variant={STATUS_VARIANTS[lease.status]}>
                          {STATUS_LABELS[lease.status]}
                        </Badge>
                      </div>
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
