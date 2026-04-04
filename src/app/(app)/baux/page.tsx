import { getLeases } from "@/actions/lease";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LeaseStatus, LeaseType, TenantEntityType, PaymentFrequency } from "@/generated/prisma/client";

const FREQ_PERIOD_LABELS: Record<PaymentFrequency, string> = {
  MENSUEL: "mois",
  TRIMESTRIEL: "trimestre",
  SEMESTRIEL: "semestre",
  ANNUEL: "an",
};

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
  BAIL_PROFESSIONNEL: "Professionnel",
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
          <p className="text-sm text-muted-foreground mt-0.5">
            {actifs.length} {actifs.length > 1 ? "baux actifs" : "bail actif"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/import">
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Import bail PDF
            </Button>
          </Link>
          <Link href="/baux/nouveau">
            <Button>
              <Plus className="h-4 w-4" />
              Nouveau bail
            </Button>
          </Link>
        </div>
      </div>

      {leases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 mb-4">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucun bail</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-5">
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
              <CardTitle className="text-base">Baux actifs ({actifs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {actifs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun bail actif
                </p>
              ) : (
                <>
                  <div className="divide-y divide-border/50">
                    {actifs.map((lease) => (
                      <Link
                        key={lease.id}
                        href={`/baux/${lease.id}`}
                        className="flex items-center justify-between py-3 px-2 -mx-2 hover:bg-accent/40 rounded-lg transition-colors"
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
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium tabular-nums">
                              {lease.currentRentHT.toLocaleString("fr-FR")} &euro; HT/{FREQ_PERIOD_LABELS[lease.paymentFrequency]}
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
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground">Total loyers mensuels (base)</span>
                    <span className="text-sm font-bold tabular-nums">
                      {actifs.reduce((sum, l) => {
                        const mult: Record<string, number> = { MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12 };
                        return sum + l.currentRentHT / (mult[l.paymentFrequency] ?? 1);
                      }, 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &euro; HT/mois
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Autres baux */}
          {autres.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Baux terminés / autres ({autres.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/50">
                  {autres.map((lease) => (
                    <Link
                      key={lease.id}
                      href={`/baux/${lease.id}`}
                      className="flex items-center justify-between py-3 px-2 -mx-2 hover:bg-accent/40 rounded-lg transition-colors opacity-60"
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
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {lease.baseRentHT.toLocaleString("fr-FR")} &euro; HT/{FREQ_PERIOD_LABELS[lease.paymentFrequency]}
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
