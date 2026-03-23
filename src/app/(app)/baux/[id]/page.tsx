import { getLeaseById } from "@/actions/lease";
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
  CalendarClock,
  ClipboardList,
  FileText,
  Pencil,
  Plus,
  Receipt,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LeasePdfUpload } from "@/components/lease-pdf-upload";
import type {
  LeaseStatus,
  LeaseType,
  PaymentFrequency,
  TenantEntityType,
} from "@prisma/client";
import { DeleteLeaseButton } from "./_components/delete-lease-button";
import { ChargeProvisions } from "./_components/charge-provisions";

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
  COMMERCIAL_369: "Bail commercial 3-6-9",
  DEROGATOIRE: "Bail dérogatoire",
  PRECAIRE: "Convention d'occupation précaire",
};

const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  PAYE: "Payée",
  PARTIELLEMENT_PAYE: "Part. payée",
  EN_RETARD: "En retard",
  LITIGIEUX: "Litigieux",
};

const INVOICE_STATUS_VARIANTS: Record<
  string,
  "success" | "secondary" | "warning" | "destructive" | "default"
> = {
  EN_ATTENTE: "default",
  PAYE: "success",
  PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive",
  LITIGIEUX: "destructive",
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

export default async function BailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const lease = await getLeaseById(societyId, id);
  if (!lease) notFound();

  const isActive = lease.status === "EN_COURS";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/baux">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {tenantName(lease.tenant)}
              </h1>
              <Badge variant={STATUS_VARIANTS[lease.status]}>
                {STATUS_LABELS[lease.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {lease.lot.building.name} — Lot {lease.lot.number},{" "}
              {lease.lot.building.city}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <Link href={`/baux/${lease.id}/modifier`}>
              <Button variant="outline">
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
            </Link>
          )}
          <DeleteLeaseButton
            societyId={societyId}
            leaseId={lease.id}
            leaseStatus={lease.status}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document du bail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document du bail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeasePdfUpload leaseId={lease.id} currentFileUrl={lease.leaseFileUrl ?? null} />
            </CardContent>
          </Card>

          {/* Informations générales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Informations du bail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Type de bail</p>
                  <p className="text-sm font-medium">
                    {TYPE_LABELS[lease.leaseType]}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Fréquence de paiement
                  </p>
                  <p className="text-sm font-medium">
                    {FREQUENCY_LABELS[lease.paymentFrequency]}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date de début</p>
                  <p className="text-sm font-medium">
                    {new Date(lease.startDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date de fin</p>
                  <p className="text-sm font-medium">
                    {new Date(lease.endDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Durée</p>
                  <p className="text-sm font-medium">
                    {lease.durationMonths} mois (
                    {Math.floor(lease.durationMonths / 12)} ans)
                  </p>
                </div>
                {(lease.rentFreeMonths ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Franchise de loyer
                    </p>
                    <p className="text-sm font-medium">
                      {lease.rentFreeMonths} mois
                    </p>
                  </div>
                )}
                {(lease.entryFee ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Pas-de-porte</p>
                    <p className="text-sm font-medium">
                      {(lease.entryFee ?? 0).toLocaleString("fr-FR")} €
                    </p>
                  </div>
                )}
                {lease.entryDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Date d&apos;entrée effective
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(lease.entryDate).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                )}
                {lease.exitDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Date de sortie</p>
                    <p className="text-sm font-medium">
                      {new Date(lease.exitDate).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                )}
              </div>

              {lease.tenantWorksClauses && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Clauses travaux
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {lease.tenantWorksClauses}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Loyer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Loyer et finances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Loyer de base HT
                  </p>
                  <p className="text-lg font-semibold">
                    {lease.baseRentHT.toLocaleString("fr-FR")} € / mois
                  </p>
                </div>
                {lease.currentRentHT !== lease.baseRentHT && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Loyer actuel HT
                    </p>
                    <p className="text-lg font-semibold text-primary">
                      {lease.currentRentHT.toLocaleString("fr-FR")} € / mois
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">TVA</p>
                  <p className="text-sm font-medium">
                    {lease.vatApplicable
                      ? `Applicable — ${lease.vatRate} %`
                      : "Non applicable"}
                  </p>
                </div>
                {lease.vatApplicable && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Loyer actuel TTC
                    </p>
                    <p className="text-sm font-medium">
                      {(
                        lease.currentRentHT *
                        (1 + lease.vatRate / 100)
                      ).toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      € / mois
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">
                    Dépôt de garantie
                  </p>
                  <p className="text-sm font-medium">
                    {lease.depositAmount.toLocaleString("fr-FR")} €
                  </p>
                </div>
              </div>

              {lease.indexType && (
                <>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Indice de révision
                      </p>
                      <p className="text-sm font-medium">{lease.indexType}</p>
                    </div>
                    {lease.baseIndexValue && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Valeur de référence
                        </p>
                        <p className="text-sm font-medium">
                          {lease.baseIndexValue}
                        </p>
                      </div>
                    )}
                    {lease.baseIndexQuarter && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Trimestre de référence
                        </p>
                        <p className="text-sm font-medium">
                          {lease.baseIndexQuarter}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Fréquence de révision
                      </p>
                      <p className="text-sm font-medium">
                        Tous les {lease.revisionFrequency} mois
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Provisions sur charges */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Provisions sur charges et taxes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChargeProvisions
                leaseId={lease.id}
                lotId={lease.lot.id}
                societyId={societyId}
                provisions={lease.chargeProvisions}
                isActive={isActive}
              />
            </CardContent>
          </Card>

          {/* Historique des révisions */}
          {lease.rentRevisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Révisions de loyer ({lease._count.rentRevisions})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {lease.rentRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(rev.effectiveDate).toLocaleDateString(
                            "fr-FR"
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Indice {rev.indexType} : {rev.newIndexValue}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {rev.newRentHT.toLocaleString("fr-FR")} € HT
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Précédent :{" "}
                          {rev.previousRentHT.toLocaleString("fr-FR")} €
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* États des lieux */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  États des lieux ({lease._count.inspections})
                </CardTitle>
                {isActive && (
                  <Link href={`/baux/${lease.id}/inspections/nouveau`}>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                      Nouveau
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {lease.inspections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun état des lieux enregistré
                </p>
              ) : (
                <div className="divide-y">
                  {lease.inspections.map((insp) => (
                    <div
                      key={insp.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {insp.type === "ENTREE"
                            ? "Entrée"
                            : "Sortie"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(insp.performedAt).toLocaleDateString("fr-FR")}
                          {insp.performedBy ? ` — ${insp.performedBy}` : ""}
                        </p>
                      </div>
                      <Link href={`/baux/${lease.id}/inspections/${insp.id}`}>
                        <Button variant="ghost" size="sm">
                          Voir
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Factures récentes */}
          {lease.invoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Factures récentes ({lease._count.invoices})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {lease.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          Échéance :{" "}
                          {new Date(inv.dueDate).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-medium">
                          {inv.totalHT.toLocaleString("fr-FR")} € HT
                        </p>
                        <Badge
                          variant={
                            INVOICE_STATUS_VARIANTS[inv.status] ?? "default"
                          }
                        >
                          {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Locataire */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Locataire
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">
                  {tenantName(lease.tenant)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lease.tenant.entityType === "PERSONNE_MORALE"
                    ? "Personne morale"
                    : "Personne physique"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm">{lease.tenant.email}</p>
              </div>
              {lease.tenant.phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Téléphone</p>
                  <p className="text-sm">{lease.tenant.phone}</p>
                </div>
              )}
              {lease.tenant.mobile && (
                <div>
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  <p className="text-sm">{lease.tenant.mobile}</p>
                </div>
              )}
              <Link href={`/locataires/${lease.tenant.id}`}>
                <Button variant="outline" size="sm" className="w-full mt-2">
                  Voir le locataire
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Lot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Bien loué
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">
                  {lease.lot.building.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lease.lot.building.city}
                  {lease.lot.building.postalCode
                    ? ` (${lease.lot.building.postalCode})`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lot</p>
                <p className="text-sm font-medium">N° {lease.lot.number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Surface</p>
                <p className="text-sm">{lease.lot.area} m²</p>
              </div>
              <Link
                href={`/patrimoine/immeubles/${lease.lot.building.id}/lots/${lease.lot.id}`}
              >
                <Button variant="outline" size="sm" className="w-full mt-2">
                  Voir le lot
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Échéances */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Échéances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const endDate = new Date(lease.endDate);
                const now = new Date();
                const daysLeft = Math.ceil(
                  (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                );
                const monthsLeft = Math.ceil(daysLeft / 30);

                if (daysLeft < 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      Bail expiré le{" "}
                      {endDate.toLocaleDateString("fr-FR")}
                    </p>
                  );
                }

                return (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Fin de bail
                    </p>
                    <p className="text-sm font-medium">
                      {endDate.toLocaleDateString("fr-FR")}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        monthsLeft <= 3
                          ? "text-destructive font-medium"
                          : monthsLeft <= 6
                          ? "text-warning"
                          : "text-muted-foreground"
                      }`}
                    >
                      Dans {daysLeft} jours ({monthsLeft} mois)
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Actions */}
          {isActive && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/baux/${lease.id}/modifier`} className="block">
                  <Button variant="outline" size="sm" className="w-full">
                    <Pencil className="h-4 w-4" />
                    Modifier le bail
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
