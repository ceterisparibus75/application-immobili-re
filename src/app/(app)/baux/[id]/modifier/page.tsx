"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateLease } from "@/actions/lease";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const LEASE_TYPE_OPTIONS = [
  {
    group: "Habitation",
    items: [
      { value: "HABITATION", label: "Bail d'habitation vide (loi 1989)" },
      { value: "MEUBLE", label: "Bail meublé (ALUR)" },
      { value: "ETUDIANT", label: "Bail étudiant meublé (9 mois)" },
      { value: "MOBILITE", label: "Bail mobilité (ELAN)" },
      { value: "COLOCATION", label: "Bail colocation" },
      { value: "SAISONNIER", label: "Location saisonnière (< 90 jours)" },
      { value: "LOGEMENT_FONCTION", label: "Logement de fonction" },
      { value: "ANAH", label: "Convention ANAH (loyer maîtrisé)" },
      { value: "CIVIL", label: "Bail civil (Code civil / résidence secondaire)" },
      { value: "GLISSANT", label: "Bail glissant (insertion sociale)" },
      { value: "SOUS_LOCATION", label: "Sous-location autorisée" },
    ],
  },
  {
    group: "Commercial / Professionnel",
    items: [
      { value: "COMMERCIAL_369", label: "Bail commercial 3/6/9" },
      { value: "DEROGATOIRE", label: "Bail dérogatoire (< 3 ans)" },
      { value: "PRECAIRE", label: "Convention d'occupation précaire" },
      { value: "BAIL_PROFESSIONNEL", label: "Bail professionnel (6 ans)" },
      { value: "MIXTE", label: "Bail mixte (habitation + professionnel)" },
    ],
  },
  {
    group: "Baux longs / Fonciers",
    items: [
      { value: "EMPHYTEOTIQUE", label: "Bail emphytéotique (18-99 ans)" },
      { value: "CONSTRUCTION", label: "Bail à construction" },
      { value: "REHABILITATION", label: "Bail à réhabilitation" },
      { value: "BRS", label: "Bail réel solidaire (OFS)" },
    ],
  },
  {
    group: "Rural",
    items: [{ value: "RURAL", label: "Bail rural / agricole (9 ans min.)" }],
  },
];

const STATUS_OPTIONS = [
  { value: "EN_COURS", label: "En cours" },
  { value: "EN_NEGOCIATION", label: "En négociation" },
  { value: "RENOUVELE", label: "Renouvelé" },
  { value: "CONTENTIEUX", label: "Contentieux" },
  { value: "RESILIE", label: "Résilié" },
];

const INDEX_TYPES = [
  { value: "IRL", label: "IRL — Indice de Référence des Loyers" },
  { value: "ILC", label: "ILC — Indice des Loyers Commerciaux" },
  {
    value: "ILAT",
    label: "ILAT — Indice des Loyers des Activités Tertiaires",
  },
  { value: "ICC", label: "ICC — Indice du Coût de la Construction" },
];

const REVISION_DATE_BASIS_OPTIONS = [
  { value: "DATE_SIGNATURE", label: "Date anniversaire du bail" },
  { value: "DATE_ENTREE", label: "Date d'entrée dans les lieux" },
  { value: "PREMIER_JANVIER", label: "1er janvier de chaque exercice" },
  { value: "DATE_PERSONNALISEE", label: "Date personnalisée" },
];

const DESTINATION_OPTIONS = [
  { value: "", label: "— Non renseignée —" },
  { value: "HABITATION", label: "Habitation" },
  { value: "BUREAU", label: "Bureau" },
  { value: "COMMERCE", label: "Commerce / Boutique" },
  { value: "ACTIVITE", label: "Local d'activité / Atelier" },
  { value: "ENTREPOT", label: "Entrepôt / Stockage" },
  { value: "INDUSTRIEL", label: "Local industriel" },
  { value: "PROFESSIONNEL", label: "Cabinet libéral" },
  { value: "MIXTE", label: "Mixte (habitation + professionnel)" },
  { value: "PARKING", label: "Parking / Garage" },
  { value: "TERRAIN", label: "Terrain nu" },
  { value: "AGRICOLE", label: "Agricole" },
  { value: "HOTELLERIE", label: "Hôtellerie / Tourisme" },
  { value: "EQUIPEMENT", label: "Équipement (salle, crèche…)" },
  { value: "AUTRE", label: "Autre" },
];

const FEE_BASIS_OPTIONS = [
  { value: "LOYER_HT", label: "Loyer HT seul" },
  { value: "LOYER_CHARGES_HT", label: "Loyer + charges HT" },
  { value: "TOTAL_TTC", label: "Total TTC" },
];

type AgencyOption = {
  id: string;
  name: string;
  company?: string | null;
};

const BILLING_TERMS = [
  {
    value: "A_ECHOIR",
    label: "Terme à échoir (paiement en début de période)",
  },
  { value: "ECHU", label: "Terme échu (paiement en fin de période)" },
];

const PAYMENT_FREQUENCIES = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
  { value: "SEMESTRIEL", label: "Semestriel" },
  { value: "ANNUEL", label: "Annuel" },
];

const FREQ_PERIOD_LABELS: Record<string, string> = {
  MENSUEL: "mois",
  TRIMESTRIEL: "trimestre",
  SEMESTRIEL: "semestre",
  ANNUEL: "an",
};

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  try {
    return new Date(val).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

type LeaseData = {
  id: string;
  leaseType: string;
  destination?: string | null;
  status: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  baseRentHT: number;
  currentRentHT: number;
  depositAmount: number;
  vatApplicable: boolean;
  vatRate: number;
  billingTerm: string;
  paymentFrequency: string;
  indexType?: string | null;
  baseIndexValue?: number | null;
  baseIndexQuarter?: string | null;
  revisionFrequency: number;
  revisionDateBasis?: string | null;
  revisionCustomMonth?: number | null;
  revisionCustomDay?: number | null;
  tenantWorksClauses?: string | null;
  entryDate?: string | null;
  exitDate?: string | null;
  rentFreeMonths?: number | null;
  entryFee?: number | null;
  isThirdPartyManaged?: boolean;
  managingContactId?: string | null;
  managementFeeType?: string | null;
  managementFeeValue?: number | null;
  managementFeeBasis?: string | null;
  managementFeeVatRate?: number | null;
  tenant?: { firstName: string; lastName: string; companyName?: string | null } | null;
  lot?: { name: string; building?: { name: string } | null } | null;
};

export default function ModifierBailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [lease, setLease] = useState<LeaseData | null>(null);
  const [destination, setDestination] = useState("");
  const [vatApplicable, setVatApplicable] = useState(false);
  const [frequency, setFrequency] = useState("MENSUEL");
  const [revisionDateBasis, setRevisionDateBasis] = useState("DATE_SIGNATURE");
  const [isThirdPartyManaged, setIsThirdPartyManaged] = useState(false);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [managingContactId, setManagingContactId] = useState("");
  const [managementFeeType, setManagementFeeType] = useState<"POURCENTAGE" | "FORFAIT">("POURCENTAGE");
  const [managementFeeValue, setManagementFeeValue] = useState(0);
  const [managementFeeBasis, setManagementFeeBasis] = useState<"LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC">("LOYER_HT");
  const [managementFeeVatRate, setManagementFeeVatRate] = useState(20);

  useEffect(() => {
    async function fetchLease() {
      try {
        const res = await fetch(`/api/leases/${params.id}`);
        if (res.ok) {
          const json = (await res.json()) as { data: LeaseData };
          setLease(json.data);
          setDestination(json.data.destination ?? "");
          setVatApplicable(json.data.vatApplicable);
          setFrequency(json.data.paymentFrequency);
          setRevisionDateBasis(json.data.revisionDateBasis ?? "DATE_SIGNATURE");
          setIsThirdPartyManaged(json.data.isThirdPartyManaged ?? false);
          setManagingContactId(json.data.managingContactId ?? "");
          setManagementFeeType((json.data.managementFeeType as "POURCENTAGE" | "FORFAIT") ?? "POURCENTAGE");
          setManagementFeeValue(json.data.managementFeeValue ?? 0);
          setManagementFeeBasis((json.data.managementFeeBasis as "LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC") ?? "LOYER_HT");
          setManagementFeeVatRate(json.data.managementFeeVatRate ?? 20);
        }
      } finally {
        setIsFetching(false);
      }
    }
    void fetchLease();
  }, [params.id]);

  useEffect(() => {
    if (!isThirdPartyManaged) return;
    async function fetchAgencies() {
      try {
        const res = await fetch("/api/contacts?type=AGENCE");
        if (res.ok) {
          const json = await res.json() as { data: AgencyOption[] };
          setAgencies(json.data ?? []);
        }
      } catch { /* ignore */ }
    }
    void fetchAgencies();
  }, [isThirdPartyManaged]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety || !lease) return;

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const d = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await updateLease(activeSociety.id, {
      id: params.id,
      leaseType: d.leaseType as
        | "HABITATION"
        | "MEUBLE"
        | "COMMERCIAL_369"
        | "DEROGATOIRE",
      destination: (destination || null) as "HABITATION" | "BUREAU" | "COMMERCE" | "ACTIVITE" | "ENTREPOT" | "INDUSTRIEL" | "PROFESSIONNEL" | "MIXTE" | "PARKING" | "TERRAIN" | "AGRICOLE" | "HOTELLERIE" | "EQUIPEMENT" | "AUTRE" | null,
      status: d.status as "EN_COURS" | "RESILIE" | "RENOUVELE",
      startDate: d.startDate || null,
      endDate: d.endDate || null,
      durationMonths: parseInt(d.durationMonths) || undefined,
      baseRentHT: parseFloat(d.baseRentHT) || undefined,
      currentRentHT: parseFloat(d.currentRentHT),
      depositAmount: parseFloat(d.depositAmount) || 0,
      vatApplicable: d.vatApplicable === "on",
      vatRate: parseFloat(d.vatRate) || 20,
      indexType:
        (d.indexType as "IRL" | "ILC" | "ILAT" | "ICC") || null,
      baseIndexValue: d.baseIndexValue
        ? parseFloat(d.baseIndexValue)
        : null,
      baseIndexQuarter: d.baseIndexQuarter || null,
      revisionFrequency: parseInt(d.revisionFrequency) || 12,
      revisionDateBasis: (d.revisionDateBasis as "DATE_SIGNATURE" | "DATE_ENTREE" | "PREMIER_JANVIER" | "DATE_PERSONNALISEE") || "DATE_SIGNATURE",
      revisionCustomMonth: d.revisionCustomMonth ? parseInt(d.revisionCustomMonth) : null,
      revisionCustomDay: d.revisionCustomDay ? parseInt(d.revisionCustomDay) : null,
      billingTerm:
        (d.billingTerm as "ECHU" | "A_ECHOIR") || undefined,
      paymentFrequency:
        (d.paymentFrequency as
          | "MENSUEL"
          | "TRIMESTRIEL"
          | "SEMESTRIEL"
          | "ANNUEL") || undefined,
      tenantWorksClauses: d.tenantWorksClauses || null,
      entryDate: d.entryDate || null,
      exitDate: d.exitDate || null,
      rentFreeMonths:
        d.rentFreeMonths !== undefined
          ? parseFloat(d.rentFreeMonths) || 0
          : undefined,
      entryFee:
        d.entryFee !== undefined
          ? parseFloat(d.entryFee) || 0
          : undefined,
      isThirdPartyManaged,
      ...(isThirdPartyManaged
        ? {
            managingContactId: managingContactId || undefined,
            managementFeeType,
            managementFeeValue,
            managementFeeBasis: managementFeeType === "POURCENTAGE" ? managementFeeBasis : undefined,
            managementFeeVatRate,
          }
        : {
            managingContactId: null,
            managementFeeType: null,
            managementFeeValue: null,
            managementFeeBasis: null,
            managementFeeVatRate: null,
          }),
    });

    setIsLoading(false);

    if (result.success) {
      router.push(`/baux/${params.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Bail introuvable
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/baux/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Modifier le bail
          </h1>
          <p className="text-muted-foreground">
            Mise à jour des informations du bail
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type et Statut */}
        <Card>
          <CardHeader>
            <CardTitle>Type et statut du bail</CardTitle>
            <CardDescription>
              Le changement de statut en &quot;Résilié&quot; libère
              automatiquement le lot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leaseType">Type de bail *</Label>
                <select
                  id="leaseType"
                  name="leaseType"
                  defaultValue={lease.leaseType}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {LEASE_TYPE_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut *</Label>
                <NativeSelect
                  id="status"
                  name="status"
                  options={STATUS_OPTIONS}
                  defaultValue={lease.status}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destination des locaux</Label>
                <NativeSelect
                  id="destination"
                  name="destination"
                  options={DESTINATION_OPTIONS}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle>Durée et dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Date de début *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={toDateInput(lease.startDate)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Date de fin *</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={toDateInput(lease.endDate)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Durée (mois)</Label>
                <Input
                  id="durationMonths"
                  name="durationMonths"
                  type="number"
                  min={1}
                  defaultValue={lease.durationMonths}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entryDate">
                  Date d&apos;entrée effective
                </Label>
                <Input
                  id="entryDate"
                  name="entryDate"
                  type="date"
                  defaultValue={toDateInput(lease.entryDate)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exitDate">Date de sortie effective</Label>
                <Input
                  id="exitDate"
                  name="exitDate"
                  type="date"
                  defaultValue={toDateInput(lease.exitDate)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loyer */}
        <Card>
          <CardHeader>
            <CardTitle>Loyer et conditions financières</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="baseRentHT">
                  Loyer de base HT (€/
                  {FREQ_PERIOD_LABELS[frequency] ?? "mois"})
                </Label>
                <Input
                  id="baseRentHT"
                  name="baseRentHT"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lease.baseRentHT}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentRentHT">
                  Loyer actuel HT (€/
                  {FREQ_PERIOD_LABELS[frequency] ?? "mois"}) *
                </Label>
                <Input
                  id="currentRentHT"
                  name="currentRentHT"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lease.currentRentHT}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="depositAmount">
                  Dépôt de garantie (€)
                </Label>
                <Input
                  id="depositAmount"
                  name="depositAmount"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lease.depositAmount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rentFreeMonths">
                  Franchise de loyer (mois)
                </Label>
                <Input
                  id="rentFreeMonths"
                  name="rentFreeMonths"
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={lease.rentFreeMonths ?? 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryFee">
                  Pas-de-porte / droit d&apos;entrée (€)
                </Label>
                <Input
                  id="entryFee"
                  name="entryFee"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={lease.entryFee ?? 0}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentFrequency">
                  Fréquence de paiement *
                </Label>
                <NativeSelect
                  id="paymentFrequency"
                  name="paymentFrequency"
                  options={PAYMENT_FREQUENCIES}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingTerm">Terme des loyers *</Label>
                <NativeSelect
                  id="billingTerm"
                  name="billingTerm"
                  options={BILLING_TERMS}
                  defaultValue={lease.billingTerm}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="vatApplicable"
                name="vatApplicable"
                defaultChecked={lease.vatApplicable}
                className="h-4 w-4 rounded border-input"
                onChange={(e) => setVatApplicable(e.target.checked)}
              />
              <Label htmlFor="vatApplicable">TVA applicable</Label>
              {vatApplicable && (
                <div className="flex items-center gap-2 ml-4">
                  <Label htmlFor="vatRate">Taux</Label>
                  <Input
                    id="vatRate"
                    name="vatRate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    defaultValue={lease.vatRate}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Indexation */}
        <Card>
          <CardHeader>
            <CardTitle>Indexation</CardTitle>
            <CardDescription>
              Indice de révision du loyer (IRL, ILC, ILAT ou ICC)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="indexType">Indice de référence</Label>
                <NativeSelect
                  id="indexType"
                  name="indexType"
                  options={INDEX_TYPES}
                  defaultValue={lease.indexType ?? ""}
                  placeholder="Sans indexation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseIndexValue">
                  Valeur de référence
                </Label>
                <Input
                  id="baseIndexValue"
                  name="baseIndexValue"
                  type="number"
                  step={0.01}
                  defaultValue={lease.baseIndexValue ?? ""}
                  placeholder="Ex: 132.45"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseIndexQuarter">
                  Trimestre de référence
                </Label>
                <Input
                  id="baseIndexQuarter"
                  name="baseIndexQuarter"
                  defaultValue={lease.baseIndexQuarter ?? ""}
                  placeholder="Ex: T1 2024"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="revisionFrequency">
                  Fréquence de révision (mois)
                </Label>
                <Input
                  id="revisionFrequency"
                  name="revisionFrequency"
                  type="number"
                  min={1}
                  defaultValue={lease.revisionFrequency}
                  className="w-32"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revisionDateBasis">Date de révision</Label>
                <NativeSelect
                  id="revisionDateBasis"
                  name="revisionDateBasis"
                  options={REVISION_DATE_BASIS_OPTIONS}
                  value={revisionDateBasis}
                  onChange={(e) => setRevisionDateBasis(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Détermine la date anniversaire à laquelle la révision est calculée
                </p>
              </div>
            </div>
            {revisionDateBasis === "DATE_PERSONNALISEE" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="revisionCustomDay">Jour</Label>
                  <Input
                    id="revisionCustomDay"
                    name="revisionCustomDay"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={lease.revisionCustomDay ?? 1}
                    className="w-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revisionCustomMonth">Mois</Label>
                  <NativeSelect
                    id="revisionCustomMonth"
                    name="revisionCustomMonth"
                    options={[
                      { value: "1", label: "Janvier" }, { value: "2", label: "Février" },
                      { value: "3", label: "Mars" }, { value: "4", label: "Avril" },
                      { value: "5", label: "Mai" }, { value: "6", label: "Juin" },
                      { value: "7", label: "Juillet" }, { value: "8", label: "Août" },
                      { value: "9", label: "Septembre" }, { value: "10", label: "Octobre" },
                      { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" },
                    ]}
                    value={String(lease.revisionCustomMonth ?? 1)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clauses */}
        <Card>
          <CardHeader>
            <CardTitle>Clauses particulières</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="tenantWorksClauses">
                Travaux et aménagements autorisés
              </Label>
              <Textarea
                id="tenantWorksClauses"
                name="tenantWorksClauses"
                rows={3}
                defaultValue={lease.tenantWorksClauses ?? ""}
                placeholder="Travaux autorisés, conditions de restitution des lieux..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Gestion tiers */}
        <Card>
          <CardHeader>
            <CardTitle>Gestion tiers</CardTitle>
            <CardDescription>
              Confiez la gestion de ce bail à une agence ou un tiers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isThirdPartyManaged"
                checked={isThirdPartyManaged}
                className="h-4 w-4 rounded border-input"
                onChange={(e) => setIsThirdPartyManaged(e.target.checked)}
              />
              <Label htmlFor="isThirdPartyManaged">
                Bail sous gestion tiers
              </Label>
            </div>

            {isThirdPartyManaged && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="managingContactId">Agence de gestion</Label>
                  <NativeSelect
                    id="managingContactId"
                    options={agencies.map((a) => ({
                      value: a.id,
                      label: a.company ? `${a.name} — ${a.company}` : a.name,
                    }))}
                    value={managingContactId}
                    onChange={(e) => setManagingContactId(e.target.value)}
                    placeholder="Sélectionner une agence..."
                  />
                  {agencies.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aucune agence trouvée.{" "}
                      <Link href="/contacts" className="underline">
                        Gérer les contacts
                      </Link>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Type d&apos;honoraires</Label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="managementFeeType"
                        value="POURCENTAGE"
                        checked={managementFeeType === "POURCENTAGE"}
                        onChange={() => setManagementFeeType("POURCENTAGE")}
                        className="h-4 w-4"
                      />
                      Pourcentage
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="managementFeeType"
                        value="FORFAIT"
                        checked={managementFeeType === "FORFAIT"}
                        onChange={() => setManagementFeeType("FORFAIT")}
                        className="h-4 w-4"
                      />
                      Forfait
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="managementFeeValue">
                      {managementFeeType === "POURCENTAGE"
                        ? "Taux (%)"
                        : "Montant (€)"}
                    </Label>
                    <Input
                      id="managementFeeValue"
                      type="number"
                      min={0}
                      step={managementFeeType === "POURCENTAGE" ? 0.1 : 0.01}
                      value={managementFeeValue}
                      onChange={(e) =>
                        setManagementFeeValue(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>

                  {managementFeeType === "POURCENTAGE" && (
                    <div className="space-y-2">
                      <Label htmlFor="managementFeeBasis">
                        Base de calcul
                      </Label>
                      <NativeSelect
                        id="managementFeeBasis"
                        options={FEE_BASIS_OPTIONS}
                        value={managementFeeBasis}
                        onChange={(e) => setManagementFeeBasis(e.target.value as "LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC")}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managementFeeVatRate">
                    Taux de TVA sur honoraires (%)
                  </Label>
                  <Input
                    id="managementFeeVatRate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={managementFeeVatRate}
                    onChange={(e) =>
                      setManagementFeeVatRate(parseFloat(e.target.value) || 0)
                    }
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/baux/${params.id}`}>
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer les modifications"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
