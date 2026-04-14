import { getLeaseById, getLeaseFinancialSummary, getLeaseDocuments } from "@/actions/lease";
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
  Briefcase,
  Building2,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  Receipt,
  User,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type {
  LeaseStatus,
  LeaseType,
  LeaseDestination,
  PaymentFrequency,
  TenantEntityType,
} from "@/generated/prisma/client";
import { DeleteLeaseButton } from "./_components/delete-lease-button";
import { RentValuationPanelWrapper } from "./_components/rent-valuation-wrapper";
import { LeaseStatusCard } from "./_components/lease-status-card";
import { LeaseTimelineBar } from "./_components/lease-timeline-bar";
import { LeaseDetailTabs } from "./_components/lease-detail-tabs";

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
  HABITATION: "Bail d'habitation (loi 1989)",
  MEUBLE: "Bail meublé (ALUR)",
  ETUDIANT: "Bail étudiant meublé (9 mois)",
  MOBILITE: "Bail mobilité (ELAN)",
  COLOCATION: "Bail colocation",
  SAISONNIER: "Location saisonnière",
  LOGEMENT_FONCTION: "Logement de fonction",
  ANAH: "Convention ANAH",
  CIVIL: "Bail civil (Code civil)",
  GLISSANT: "Bail glissant",
  SOUS_LOCATION: "Sous-location",
  COMMERCIAL_369: "Bail commercial 3/6/9",
  DEROGATOIRE: "Bail dérogatoire",
  PRECAIRE: "Convention d'occupation précaire",
  BAIL_PROFESSIONNEL: "Bail professionnel",
  MIXTE: "Bail mixte",
  EMPHYTEOTIQUE: "Bail emphytéotique",
  CONSTRUCTION: "Bail à construction",
  REHABILITATION: "Bail à réhabilitation",
  BRS: "Bail réel solidaire (OFS)",
  RURAL: "Bail rural",
};

const DESTINATION_LABELS: Record<LeaseDestination, string> = {
  HABITATION: "Habitation",
  BUREAU: "Bureau",
  COMMERCE: "Commerce",
  ACTIVITE: "Activité",
  ENTREPOT: "Entrepôt",
  INDUSTRIEL: "Industriel",
  PROFESSIONNEL: "Professionnel",
  MIXTE: "Mixte",
  PARKING: "Parking",
  TERRAIN: "Terrain",
  AGRICOLE: "Agricole",
  HOTELLERIE: "Hôtellerie",
  EQUIPEMENT: "Équipement",
  AUTRE: "Autre",
};

const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

const FREQ_PERIOD_LABELS: Record<string, string> = {
  MENSUEL: "mois",
  TRIMESTRIEL: "trimestre",
  SEMESTRIEL: "semestre",
  ANNUEL: "an",
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

  const [lease, financialSummary, leaseDocuments] = await Promise.all([
    getLeaseById(societyId, id),
    getLeaseFinancialSummary(societyId, id),
    getLeaseDocuments(societyId, id),
  ]);
  if (!lease) notFound();

  const isActive = lease.status === "EN_COURS";
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const primaryLotId =
    lease.leaseLots.find((ll) => ll.isPrimary)?.lot.id ?? lease.lot.id;

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
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
              {lease.lot.building.name} —{" "}
              {lease.leaseLots.length > 1
                ? `${lease.leaseLots.length} lots`
                : `Lot ${lease.lot.number}`}
              , {lease.lot.building.city}
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

      {/* ── Timeline de progression ────────────────────────────────────────── */}
      {lease.endDate && (
        <LeaseTimelineBar
          startDate={lease.startDate}
          endDate={lease.endDate}
          now={nowMs}
          rentRevisions={(lease.rentRevisions ?? []).map((r) => ({
            effectiveDate: r.effectiveDate,
          }))}
          rentSteps={(lease.rentSteps ?? []).map((s) => ({
            startDate: s.startDate,
            amount: s.rentHT,
          }))}
        />
      )}

      {/* ── Contenu principal ─────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Onglets (2/3) */}
        <div className="lg:col-span-2">
          <LeaseDetailTabs
            leaseId={lease.id}
            societyId={societyId}
            lotId={lease.lot.id}
            isActive={isActive}
            tenantId={lease.tenant.id}
            primaryLotId={primaryLotId}
            currentRentHT={lease.currentRentHT}
            contrat={{
              leaseTypeLabel: TYPE_LABELS[lease.leaseType],
              destinationLabel: lease.destination
                ? (DESTINATION_LABELS[lease.destination as LeaseDestination] ?? lease.destination)
                : "Non renseignée",
              frequencyLabel: FREQUENCY_LABELS[lease.paymentFrequency],
              freqPeriodLabel: FREQ_PERIOD_LABELS[lease.paymentFrequency] ?? "mois",
              startDate: lease.startDate,
              endDate: lease.endDate ?? null,
              durationMonths: lease.durationMonths,
              rentFreeMonths: lease.rentFreeMonths ?? null,
              entryFee: lease.entryFee ?? null,
              entryDate: lease.entryDate ?? null,
              exitDate: lease.exitDate ?? null,
              tenantWorksClauses: lease.tenantWorksClauses ?? null,
              leaseNumber: lease.leaseNumber ?? null,
              leaseTemplateName: lease.leaseTemplate?.name ?? null,
              baseRentHT: lease.baseRentHT,
              currentRentHT: lease.currentRentHT,
              vatApplicable: lease.vatApplicable,
              vatRate: lease.vatRate ?? 0,
              depositAmount: lease.depositAmount,
              indexType: lease.indexType ?? null,
              baseIndexValue: lease.baseIndexValue ?? null,
              baseIndexQuarter: lease.baseIndexQuarter ?? null,
              revisionFrequency: lease.revisionFrequency ?? 12,
            }}
            loyer={{
              rentSteps: lease.rentSteps.map((s) => ({
                ...s,
                startDate: s.startDate.toISOString(),
                endDate: s.endDate?.toISOString() ?? null,
              })),
              rentStepsCount: lease._count.rentSteps,
              provisions: lease.chargeProvisions,
              revisions: lease.rentRevisions,
              rentRevisionsCount: lease._count.rentRevisions,
              leaseStartDate: lease.startDate.toISOString(),
              leaseEndDate: lease.endDate?.toISOString() ?? null,
              leaseVatRate: lease.vatRate ?? 20,
              leaseVatApplicable: lease.vatApplicable,
              paymentFrequency: lease.paymentFrequency,
            }}
            facturation={{
              invoices: lease.invoices,
              invoicesCount: lease._count.invoices,
              inspections: lease.inspections,
              inspectionsCount: lease._count.inspections,
            }}
            documents={{
              leaseFileUrl: lease.leaseFileUrl ?? null,
              signatureRequests: (lease.signatureRequests ?? []).map((sr) => ({
                ...sr,
                createdAt:
                  sr.createdAt instanceof Date
                    ? sr.createdAt.toISOString()
                    : String(sr.createdAt),
                signedAt:
                  sr.signedAt instanceof Date
                    ? sr.signedAt.toISOString()
                    : sr.signedAt
                      ? String(sr.signedAt)
                      : null,
                declinedAt:
                  sr.declinedAt instanceof Date
                    ? sr.declinedAt.toISOString()
                    : sr.declinedAt
                      ? String(sr.declinedAt)
                      : null,
                voidedAt:
                  sr.voidedAt instanceof Date
                    ? sr.voidedAt.toISOString()
                    : sr.voidedAt
                      ? String(sr.voidedAt)
                      : null,
              })),
              amendments: lease.amendments,
              amendmentDocuments: lease.documents,
              amendmentsCount: lease._count.amendments,
              leaseDocuments,
            }}
            rentValuationSlot={
              <RentValuationPanelWrapper leaseId={lease.id} societyId={societyId} />
            }
          />
        </div>

        {/* ── Sidebar (1/3) ────────────────────────────────────────────────── */}
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
                <p className="text-sm font-medium">{tenantName(lease.tenant)}</p>
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
                  Voir la fiche locataire
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Bien(s) loué(s) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {lease.leaseLots.length > 1
                  ? `Biens loués (${lease.leaseLots.length})`
                  : "Bien loué"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lease.leaseLots.map((ll, idx) => (
                <div key={ll.lot.id} className={idx > 0 ? "border-t pt-3" : ""}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">N° {ll.lot.number}</p>
                    {ll.isPrimary && lease.leaseLots.length > 1 && (
                      <Badge variant="outline" className="text-[10px]">
                        Principal
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ll.lot.building.name} — {ll.lot.building.city}
                    {ll.lot.building.postalCode
                      ? ` (${ll.lot.building.postalCode})`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{ll.lot.area} m²</p>
                  <Link
                    href={`/patrimoine/immeubles/${ll.lot.building.id}/lots/${ll.lot.id}`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-1 text-xs h-7"
                    >
                      Voir le lot
                    </Button>
                  </Link>
                </div>
              ))}
              {lease.leaseLots.length > 1 && (
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">
                    Surface totale :{" "}
                    {lease.leaseLots.reduce((sum, ll) => sum + ll.lot.area, 0)} m²
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Récapitulatif financier */}
          {financialSummary && financialSummary.nbFactures > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Récapitulatif financier
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total facturé TTC</p>
                  <p className="text-sm font-semibold">
                    {financialSummary.totalFactureTTC.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total encaissé</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    {financialSummary.totalEncaisse.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </p>
                </div>
                {financialSummary.totalImpaye > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      Solde impayé
                    </p>
                    <p className="text-sm font-semibold text-destructive">
                      {financialSummary.totalImpaye.toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </p>
                  </div>
                )}
                {financialSummary.totalImpaye === 0 && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Aucun impayé
                  </p>
                )}
                <Separator />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{financialSummary.nbFactures} factures</span>
                  {financialSummary.nbImpayees > 0 && (
                    <span className="text-destructive">
                      {financialSummary.nbImpayees} en retard
                    </span>
                  )}
                </div>
                <Link href={`/facturation?leaseId=${lease.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-1">
                    Voir la facturation
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Statut du bail */}
          <LeaseStatusCard
            leaseId={lease.id}
            societyId={societyId}
            currentStatus={lease.status}
          />

          {/* Gestion tiers */}
          {lease.isThirdPartyManaged && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Gestion tiers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lease.managingContact && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Agence</p>
                      <p className="text-sm font-medium">
                        {lease.managingContact.name}
                      </p>
                      {lease.managingContact.company && (
                        <p className="text-xs text-muted-foreground">
                          {lease.managingContact.company}
                        </p>
                      )}
                    </div>
                    {lease.managingContact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm">{lease.managingContact.email}</p>
                      </div>
                    )}
                    {lease.managingContact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm">{lease.managingContact.phone}</p>
                      </div>
                    )}
                    <Separator />
                  </>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Honoraires</p>
                  <p className="text-sm font-medium">
                    {lease.managementFeeType === "POURCENTAGE"
                      ? `${lease.managementFeeValue} % HT sur ${
                          lease.managementFeeBasis === "LOYER_CHARGES_HT"
                            ? "loyer + charges"
                            : lease.managementFeeBasis === "TOTAL_TTC"
                              ? "total TTC"
                              : "loyer HT"
                        }`
                      : `${(lease.managementFeeValue ?? 0).toLocaleString("fr-FR")} EUR/mois forfait`}
                  </p>
                  {(lease.managementFeeVatRate ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      TVA : {lease.managementFeeVatRate} %
                    </p>
                  )}
                </div>
                <Link href={`/baux/${lease.id}/releves-gestion`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Décomptes de gestion
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Lien rapide documents */}
          {leaseDocuments.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <Link href="/documents">
                  <Button variant="ghost" size="sm" className="w-full gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Gérer les documents ({leaseDocuments.length})
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
