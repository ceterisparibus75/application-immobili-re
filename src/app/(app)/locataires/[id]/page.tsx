import { getTenantById } from "@/actions/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  FileText,
  Pencil,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { LeaseStatus, RiskIndicator, TenantEntityType } from "@prisma/client";

const RISK_VARIANTS: Record<RiskIndicator, "success" | "warning" | "destructive"> = {
  VERT: "success",
  ORANGE: "warning",
  ROUGE: "destructive",
};

const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  EN_COURS: "En cours",
  RESILIE: "Résilié",
  RENOUVELE: "Renouvelé",
  EN_NEGOCIATION: "En négociation",
  CONTENTIEUX: "Contentieux",
};

const LEASE_STATUS_VARIANTS: Record<LeaseStatus, "success" | "secondary" | "warning" | "destructive" | "default"> = {
  EN_COURS: "success",
  RESILIE: "secondary",
  RENOUVELE: "default",
  EN_NEGOCIATION: "warning",
  CONTENTIEUX: "destructive",
};

function tenantDisplayName(tenant: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? "—")
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";
}

export default async function LocataireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const tenant = await getTenantById(societyId, id);
  if (!tenant) notFound();

  const activeLease = tenant.leases.find((l) => l.status === "EN_COURS");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/locataires">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              {tenant.entityType === "PERSONNE_MORALE" ? (
                <Building2 className="h-5 w-5 text-muted-foreground" />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
              <h1 className="text-2xl font-bold tracking-tight">
                {tenantDisplayName(tenant)}
              </h1>
              <Badge variant={RISK_VARIANTS[tenant.riskIndicator]}>
                {tenant.riskIndicator}
              </Badge>
              {!tenant.isActive && (
                <Badge variant="secondary">Inactif</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {tenant.entityType === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}{" "}
              &bull; {tenant.email}
            </p>
          </div>
        </div>
        <Link href={`/locataires/${id}/modifier`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4" />
            Modifier
          </Button>
        </Link>
      </div>

      {/* Bail actif */}
      {activeLease ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-green-700 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Bail actif — {activeLease.lot.building.name}, Lot{" "}
                  {activeLease.lot.number}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  Depuis le{" "}
                  {new Date(activeLease.startDate).toLocaleDateString("fr-FR")}{" "}
                  &bull;{" "}
                  {activeLease.currentRentHT.toLocaleString("fr-FR")} € HT/mois
                </p>
              </div>
            </div>
            <Link href={`/baux/${activeLease.id}`}>
              <Button size="sm" variant="outline">
                Voir le bail
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        tenant.isActive && (
          <div className="rounded-md border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun bail actif pour ce locataire
            </p>
            <Link href={`/baux/nouveau?tenantId=${id}`}>
              <Button size="sm" variant="outline" className="mt-2">
                Créer un bail
              </Button>
            </Link>
          </div>
        )
      )}

      {/* Informations */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Infos spécifiques au type */}
        {tenant.entityType === "PERSONNE_MORALE" ? (
          <Card>
            <CardHeader>
              <CardTitle>Société</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Raison sociale" value={tenant.companyName} />
              <InfoRow label="Forme juridique" value={tenant.companyLegalForm} />
              <InfoRow label="SIRET" value={tenant.siret} />
              <InfoRow label="Code APE" value={tenant.codeAPE} />
              <InfoRow label="Capital social" value={tenant.shareCapital ? `${tenant.shareCapital.toLocaleString("fr-FR")} €` : null} />
              <InfoRow label="Adresse siège" value={tenant.companyAddress} />
              <Separator />
              <InfoRow label="Représentant" value={tenant.legalRepName} />
              <InfoRow label="Qualité" value={tenant.legalRepTitle} />
              <InfoRow label="Email repr." value={tenant.legalRepEmail} />
              <InfoRow label="Tél. repr." value={tenant.legalRepPhone} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Identité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Nom" value={tenant.lastName} />
              <InfoRow label="Prénom" value={tenant.firstName} />
              <InfoRow
                label="Date de naissance"
                value={tenant.birthDate ? new Date(tenant.birthDate).toLocaleDateString("fr-FR") : null}
              />
              <InfoRow label="Lieu de naissance" value={tenant.birthPlace} />
              <InfoRow label="Adresse" value={tenant.personalAddress} />
              {tenant.autoEntrepreneurSiret && (
                <>
                  <Separator />
                  <InfoRow label="SIRET auto-ent." value={tenant.autoEntrepreneurSiret} />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Email" value={tenant.email} />
            <InfoRow label="Email facturation" value={tenant.billingEmail} />
            <InfoRow label="Téléphone" value={tenant.phone} />
            <InfoRow label="Mobile" value={tenant.mobile} />
            <Separator />
            <InfoRow label="Indicateur risque" value={tenant.riskIndicator} />
            {tenant.notes && (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  {tenant.notes}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historique des baux */}
      {tenant.leases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Baux ({tenant._count.leases})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {tenant.leases.map((lease) => (
                <Link
                  key={lease.id}
                  href={`/baux/${lease.id}`}
                  className="flex items-center justify-between py-3 px-2 hover:bg-accent/50 rounded-md transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {lease.lot.building.name} — Lot {lease.lot.number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Depuis le{" "}
                      {new Date(lease.startDate).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {lease.currentRentHT.toLocaleString("fr-FR")} € HT/mois
                    </span>
                    <Badge variant={LEASE_STATUS_VARIANTS[lease.status]}>
                      {LEASE_STATUS_LABELS[lease.status]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between text-sm">
      {label && <span className="text-muted-foreground">{label}</span>}
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
