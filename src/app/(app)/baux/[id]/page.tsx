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
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  Mail,
  Pencil,
  Phone,
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
  LeaseDestination,
  PaymentFrequency,
  TenantEntityType,
} from "@/generated/prisma/client";
import { DeleteLeaseButton } from "./_components/delete-lease-button";
import { ChargeProvisions } from "./_components/charge-provisions";
import { RentRevisions } from "./_components/rent-revisions";
import { LeaseAmendments } from "./_components/lease-amendments";
import { RentValuationPanelWrapper } from "./_components/rent-valuation-wrapper";
import { LeaseSignaturePanel } from "@/components/lease-signature-panel";
import { LeaseStatusCard } from "./_components/lease-status-card";
import { RentSteps } from "./_components/rent-steps";

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

const INVOICE_STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon", VALIDEE: "Validée", ENVOYEE: "Envoyée",
  EN_ATTENTE: "En attente", PAYE: "Payée", PARTIELLEMENT_PAYE: "Part. payée",
  EN_RETARD: "En retard", RELANCEE: "Relancée", LITIGIEUX: "Litigieux",
  IRRECOUVRABLE: "Irrécouvrable", ANNULEE: "Annulée",
};

const INVOICE_STATUS_VARIANTS: Record<string, "success" | "secondary" | "warning" | "destructive" | "default" | "outline"> = {
  BROUILLON: "outline", VALIDEE: "secondary", ENVOYEE: "default",
  EN_ATTENTE: "default", PAYE: "success", PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive", RELANCEE: "destructive", LITIGIEUX: "destructive",
  IRRECOUVRABLE: "secondary", ANNULEE: "outline",
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
              {lease.lot.building.name} — {lease.leaseLots.length > 1
                ? `${lease.leaseLots.length} lots`
                : `Lot ${lease.lot.number}`},{" "}
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

          {/* Signature electronique */}
          <LeaseSignaturePanel
            leaseId={lease.id}
            leaseFileUrl={lease.leaseFileUrl ?? null}
            signatureRequests={(lease.signatureRequests ?? []).map((sr) => ({
              ...sr,
              createdAt: sr.createdAt instanceof Date ? sr.createdAt.toISOString() : String(sr.createdAt),
              signedAt: sr.signedAt instanceof Date ? sr.signedAt.toISOString() : sr.signedAt ? String(sr.signedAt) : null,
              declinedAt: sr.declinedAt instanceof Date ? sr.declinedAt.toISOString() : sr.declinedAt ? String(sr.declinedAt) : null,
              voidedAt: sr.voidedAt instanceof Date ? sr.voidedAt.toISOString() : sr.voidedAt ? String(sr.voidedAt) : null,
            }))}
            societyId={societyId}
          />

          {/* Numero de bail et modele */}
          {(lease.leaseNumber || lease.leaseTemplate) && (
            <Card>
              <CardContent className="pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {lease.leaseNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Numero de bail</p>
                      <p className="text-sm font-medium font-mono">{lease.leaseNumber}</p>
                    </div>
                  )}
                  {lease.leaseTemplate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Modele utilise</p>
                      <p className="text-sm font-medium">{lease.leaseTemplate.name}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="text-sm font-medium">
                    {lease.destination ? DESTINATION_LABELS[lease.destination as LeaseDestination] ?? lease.destination : "Non renseignée"}
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
                    {lease.baseRentHT.toLocaleString("fr-FR")} € / {FREQ_PERIOD_LABELS[lease.paymentFrequency] ?? "mois"}
                  </p>
                </div>
                {lease.currentRentHT !== lease.baseRentHT && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Loyer actuel HT
                    </p>
                    <p className="text-lg font-semibold text-primary">
                      {lease.currentRentHT.toLocaleString("fr-FR")} € / {FREQ_PERIOD_LABELS[lease.paymentFrequency] ?? "mois"}
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
                      € / {FREQ_PERIOD_LABELS[lease.paymentFrequency] ?? "mois"}
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

          {/* Paliers de loyer */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Paliers de loyer {lease._count.rentSteps > 0 && `(${lease._count.rentSteps})`}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <RentSteps
                leaseId={lease.id}
                societyId={societyId}
                steps={lease.rentSteps.map((s) => ({
                  ...s,
                  startDate: s.startDate.toISOString(),
                  endDate: s.endDate?.toISOString() ?? null,
                }))}
                isActive={isActive}
                leaseStartDate={lease.startDate.toISOString()}
                leaseEndDate={lease.endDate?.toISOString() ?? null}
              />
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
                leaseVatRate={lease.vatRate ?? 20}
                leaseVatApplicable={lease.vatApplicable}
                paymentFrequency={lease.paymentFrequency}
              />
            </CardContent>
          </Card>

          {/* Révisions de loyer */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Révisions de loyer ({lease._count.rentRevisions})
                </CardTitle>
                <Link href="/indices">
                  <Button variant="outline" size="sm" className="text-xs gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Indices IRL/ILC
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <RentRevisions
                revisions={lease.rentRevisions}
                societyId={societyId}
                isActive={isActive}
              />
            </CardContent>
          </Card>

          {/* Avenants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Avenants ({lease._count.amendments})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeaseAmendments
                amendments={lease.amendments}
                leaseId={lease.id}
                societyId={societyId}
                isActive={isActive}
                currentRentHT={lease.currentRentHT}
              />
            </CardContent>
          </Card>
          {/* Évaluation des loyers IA */}
          <Card>
            <CardContent className="pt-6">
              <RentValuationPanelWrapper leaseId={lease.id} societyId={societyId} />
            </CardContent>
          </Card>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Factures ({lease._count.invoices})
                </CardTitle>
                {isActive && (
                  <Link href={`/facturation/generer?leaseId=${lease.id}`}>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                      Générer
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {lease.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune facture émise pour ce bail
                </p>
              ) : (
                <div className="divide-y">
                  {lease.invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/facturation/${inv.id}`}
                      className="flex items-center justify-between py-3 hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
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
                    </Link>
                  ))}
                </div>
              )}
              {lease._count.invoices > 6 && (
                <Link href={`/facturation?leaseId=${lease.id}`}>
                  <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
                    Voir toutes les factures
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Statut du bail */}
          <LeaseStatusCard
            leaseId={lease.id}
            societyId={societyId}
            currentStatus={lease.status}
          />

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

          {/* Lots */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {lease.leaseLots.length > 1 ? `Biens loués (${lease.leaseLots.length})` : "Bien loué"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lease.leaseLots.map((ll, idx) => (
                <div key={ll.lot.id} className={idx > 0 ? "border-t pt-3" : ""}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">
                      N° {ll.lot.number}
                    </p>
                    {ll.isPrimary && lease.leaseLots.length > 1 && (
                      <Badge variant="outline" className="text-[10px]">Principal</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ll.lot.building.name} — {ll.lot.building.city}
                    {ll.lot.building.postalCode ? ` (${ll.lot.building.postalCode})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ll.lot.area} m²
                  </p>
                  <Link
                    href={`/patrimoine/immeubles/${ll.lot.building.id}/lots/${ll.lot.id}`}
                  >
                    <Button variant="ghost" size="sm" className="w-full mt-1 text-xs h-7">
                      Voir le lot
                    </Button>
                  </Link>
                </div>
              ))}
              {lease.leaseLots.length > 1 && (
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">
                    Surface totale : {lease.leaseLots.reduce((sum, ll) => sum + ll.lot.area, 0)} m²
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

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
