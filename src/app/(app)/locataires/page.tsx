import { getTenants } from "@/actions/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  ChevronRight,
  FileText,
  MapPin,
  Phone,
  Plus,
  User,
  Users,
} from "lucide-react";
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

const RISK_LABELS: Record<RiskIndicator, string> = {
  VERT: "Fiable",
  ORANGE: "Vigilance",
  ROUGE: "Risque",
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

function formatRent(leases: Array<{ currentRentHT: number }>) {
  const totalRent = leases.reduce((sum, l) => sum + l.currentRentHT, 0);
  if (totalRent === 0) return null;
  return totalRent.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getLocations(leases: Array<{ lot: { number: string; building: { name: string } } }>) {
  if (leases.length === 0) return null;
  const locations = leases.map((l) => `${l.lot.building.name} — Lot ${l.lot.number}`);
  return locations;
}

function insuranceStatus(expiresAt: Date | null): { label: string; variant: "success" | "warning" | "destructive" | "secondary" } {
  if (!expiresAt) return { label: "Non renseignée", variant: "secondary" };
  const now = new Date();
  const daysUntil = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return { label: "Expirée", variant: "destructive" };
  if (daysUntil < 30) return { label: `Expire dans ${daysUntil}j`, variant: "warning" };
  return { label: "Valide", variant: "success" };
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

  const totalRent = active.reduce(
    (sum, t) => sum + t.leases.reduce((s, l) => s + l.currentRentHT, 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locataires</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {active.length} actif{active.length !== 1 ? "s" : ""}
            {inactive.length > 0 && ` · ${inactive.length} ancien${inactive.length !== 1 ? "s" : ""}`}
            {totalRent > 0 && ` · ${totalRent.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € HT/mois`}
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
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 mb-4">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucun locataire</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-5">
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
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Locataires actifs ({active.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 px-4">
                  Aucun locataire actif
                </p>
              ) : (
                <div>
                  {/* En-tête desktop */}
                  <div className="hidden lg:grid lg:grid-cols-[1fr_180px_100px_80px_120px_28px] gap-3 items-center px-5 py-2.5 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Locataire</span>
                    <span>Localisation</span>
                    <span className="text-center">Assurance</span>
                    <span className="text-center">Risque</span>
                    <span className="text-right">Loyer HT</span>
                    <span />
                  </div>
                  {active.map((tenant, index) => {
                    const name = tenantName(tenant);
                    const rent = formatRent(tenant.leases);
                    const locations = getLocations(tenant.leases);
                    const insurance = insuranceStatus(tenant.insuranceExpiresAt);

                    return (
                      <Link
                        key={tenant.id}
                        href={`/locataires/${tenant.id}`}
                        className={`block transition-colors hover:bg-accent/50 group ${index < active.length - 1 ? "border-b" : ""}`}
                      >
                        {/* Desktop */}
                        <div className="hidden lg:grid lg:grid-cols-[1fr_180px_100px_80px_120px_28px] gap-3 items-center px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                              {tenant.entityType === "PERSONNE_MORALE" ? (
                                <Building2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold truncate">{name}</span>
                                <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0">
                                  {tenant.entityType === "PERSONNE_MORALE" ? "Société" : "Particulier"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                <span className="truncate">{tenant.email}</span>
                                {tenant.phone && (
                                  <span className="hidden xl:flex items-center gap-1 shrink-0">
                                    <Phone className="h-3 w-3" />
                                    {tenant.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0">
                            {locations ? (
                              <div className="space-y-0.5">
                                {locations.map((loc, i) => (
                                  <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{loc}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 italic">Aucun bail actif</span>
                            )}
                          </div>
                          <div className="flex justify-center">
                            <Badge variant={insurance.variant} className="text-[11px]">
                              {insurance.label}
                            </Badge>
                          </div>
                          <div className="flex justify-center">
                            <Badge variant={RISK_VARIANTS[tenant.riskIndicator]} className="text-[11px]">
                              {RISK_LABELS[tenant.riskIndicator]}
                            </Badge>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-right">
                            {rent ? `${rent} €` : <span className="text-muted-foreground font-normal">—</span>}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </div>

                        {/* Mobile */}
                        <div className="flex items-center justify-between px-4 py-3 lg:hidden">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              {tenant.entityType === "PERSONNE_MORALE" ? (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold truncate">{name}</span>
                                <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0">
                                  {tenant.entityType === "PERSONNE_MORALE" ? "Sté" : "Part."}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                {locations && locations.length > 0 && (
                                  <span className="truncate max-w-[160px]">{locations[0]}</span>
                                )}
                                {!locations && <span className="italic text-muted-foreground/60">Aucun bail</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <div className="text-right space-y-1">
                              <Badge variant={RISK_VARIANTS[tenant.riskIndicator]} className="text-[11px]">
                                {RISK_LABELS[tenant.riskIndicator]}
                              </Badge>
                              {rent && (
                                <p className="text-xs font-semibold tabular-nums">{rent} €</p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inactifs */}
          {inactive.length > 0 && (
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-base text-muted-foreground">
                  Anciens locataires ({inactive.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-2">
                <div>
                  {inactive.map((tenant, index) => {
                    const name = tenantName(tenant);
                    return (
                      <Link
                        key={tenant.id}
                        href={`/locataires/${tenant.id}`}
                        className={`block transition-colors hover:bg-accent/50 group opacity-60 hover:opacity-80 ${index < inactive.length - 1 ? "border-b" : ""}`}
                      >
                        <div className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              {tenant.entityType === "PERSONNE_MORALE" ? (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate">{name}</span>
                              <p className="text-xs text-muted-foreground">{tenant.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 ml-2">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3.5 w-3.5" />
                              {tenant._count.leases} {tenant._count.leases > 1 ? "baux" : "bail"}
                            </span>
                            <Badge variant="secondary" className="text-[11px]">Inactif</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
