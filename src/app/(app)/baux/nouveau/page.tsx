"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createLease } from "@/actions/lease";
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
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import {
  getDefaultDuration,
  getDefaultIndexType,
  getDefaultVat,
  getDefaultDepositMonths,
  type LeaseType,
} from "@/validations/lease";

const LEASE_TYPE_OPTIONS = [
  { group: "Habitation", items: [
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
  ]},
  { group: "Commercial / Professionnel", items: [
    { value: "COMMERCIAL_369", label: "Bail commercial 3/6/9" },
    { value: "DEROGATOIRE", label: "Bail dérogatoire (< 3 ans)" },
    { value: "PRECAIRE", label: "Convention d'occupation précaire" },
    { value: "BAIL_PROFESSIONNEL", label: "Bail professionnel (6 ans)" },
    { value: "MIXTE", label: "Bail mixte (habitation + professionnel)" },
  ]},
  { group: "Baux longs / Fonciers", items: [
    { value: "EMPHYTEOTIQUE", label: "Bail emphytéotique (18-99 ans)" },
    { value: "CONSTRUCTION", label: "Bail à construction" },
    { value: "REHABILITATION", label: "Bail à réhabilitation" },
    { value: "BRS", label: "Bail réel solidaire (OFS)" },
  ]},
  { group: "Rural", items: [
    { value: "RURAL", label: "Bail rural / agricole (9 ans min.)" },
  ]},
];

const FLAT_LEASE_TYPES = LEASE_TYPE_OPTIONS.flatMap((g) => g.items);

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

const BILLING_TERMS = [
  {
    value: "A_ECHOIR",
    label: "Terme à échoir (paiement en début de période)",
  },
  {
    value: "ECHU",
    label: "Terme échu (paiement en fin de période)",
  },
];

const INDEX_TYPES = [
  { value: "IRL", label: "IRL — Indice de Référence des Loyers" },
  { value: "ILC", label: "ILC — Indice des Loyers Commerciaux" },
  { value: "ILAT", label: "ILAT — Indice des Loyers des Activités Tertiaires" },
  { value: "ICC", label: "ICC — Indice du Coût de la Construction" },
];

type LotOption = {
  id: string;
  number: string;
  lotType: string;
  area: number;
  building: { id: string; name: string; city: string };
};

type TenantOption = {
  id: string;
  entityType: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
};

type TemplateOption = {
  id: string;
  name: string;
  leaseType: string;
  isDefault: boolean;
  defaultDurationMonths?: number | null;
  defaultPaymentFrequency?: string | null;
  defaultBillingTerm?: string | null;
  defaultVatApplicable?: boolean | null;
  defaultVatRate?: number | null;
  defaultIndexType?: string | null;
  defaultDepositMonths?: number | null;
};

type AgencyOption = {
  id: string;
  name: string;
  company?: string | null;
};

const FEE_BASIS_OPTIONS = [
  { value: "LOYER_HT", label: "Loyer HT seul" },
  { value: "LOYER_CHARGES_HT", label: "Loyer + charges HT" },
  { value: "TOTAL_TTC", label: "Total TTC" },
];

export default function NouveauBailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lots, setLots] = useState<LotOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [leaseType, setLeaseType] = useState<LeaseType>("HABITATION");
  const [vatApplicable, setVatApplicable] = useState(false);
  const [frequency, setFrequency] = useState("MENSUEL");
  const [durationMonths, setDurationMonths] = useState(36);
  const [indexType, setIndexType] = useState<string>("IRL");
  const [isThirdPartyManaged, setIsThirdPartyManaged] = useState(false);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [managingContactId, setManagingContactId] = useState<string>("");
  const [managementFeeType, setManagementFeeType] = useState<"POURCENTAGE" | "FORFAIT">("POURCENTAGE");
  const [managementFeeValue, setManagementFeeValue] = useState<number>(0);
  const [managementFeeBasis, setManagementFeeBasis] = useState<"LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC">("LOYER_HT");
  const [managementFeeVatRate, setManagementFeeVatRate] = useState<number>(20);

  function handleLeaseTypeChange(type: LeaseType) {
    setLeaseType(type);
    setSelectedTemplateId("");
    const dur = getDefaultDuration(type);
    setDurationMonths(dur);
    const vat = getDefaultVat(type);
    setVatApplicable(vat.applicable);
    const idx = getDefaultIndexType(type);
    setIndexType(idx ?? "");
    // Charger les modeles pour ce type
    if (activeSociety) {
      fetch(`/api/lease-templates?leaseType=${type}`)
        .then((r) => r.ok ? r.json() : { data: [] })
        .then((json: { data: TemplateOption[] }) => {
          setTemplates(json.data);
          // Auto-selectionner le modele par defaut
          const def = json.data.find((t: TemplateOption) => t.isDefault);
          if (def) applyTemplate(def);
        })
        .catch(() => setTemplates([]));
    }
  }

  function applyTemplate(tpl: TemplateOption) {
    setSelectedTemplateId(tpl.id);
    if (tpl.defaultDurationMonths) setDurationMonths(tpl.defaultDurationMonths);
    if (tpl.defaultPaymentFrequency) setFrequency(tpl.defaultPaymentFrequency);
    if (tpl.defaultVatApplicable !== null && tpl.defaultVatApplicable !== undefined)
      setVatApplicable(tpl.defaultVatApplicable);
    if (tpl.defaultIndexType) setIndexType(tpl.defaultIndexType);
  }

  const defaultLotId = searchParams.get("lotId") ?? "";
  const defaultTenantId = searchParams.get("tenantId") ?? "";

  useEffect(() => {
    async function fetchOptions() {
      const [lotsRes, tenantsRes] = await Promise.all([
        fetch("/api/lots/vacant"),
        fetch("/api/tenants/active"),
      ]);
      if (lotsRes.ok) {
        const json = await lotsRes.json() as { data: LotOption[] };
        setLots(json.data);
      }
      if (tenantsRes.ok) {
        const json = await tenantsRes.json() as { data: TenantOption[] };
        setTenants(json.data);
      }
    }
    void fetchOptions();
  }, []);

  useEffect(() => {
    if (!isThirdPartyManaged) return;
    async function fetchAgencies() {
      try {
        const res = await fetch("/api/contacts?type=AGENCE");
        if (res.ok) {
          const json = await res.json() as { data: AgencyOption[] };
          setAgencies(json.data ?? []);
        } else {
          setAgencies([]);
        }
      } catch {
        setAgencies([]);
      }
    }
    void fetchAgencies();
  }, [isThirdPartyManaged]);

  function tenantLabel(t: TenantOption) {
    return t.entityType === "PERSONNE_MORALE"
      ? (t.companyName ?? t.email)
      : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.email;
  }

  function lotLabel(l: LotOption) {
    return `${l.building.name} — Lot ${l.number} (${l.area} m²) — ${l.building.city}`;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune société sélectionnée");
      return;
    }

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createLease(activeSociety.id, {
      lotId: data.lotId,
      tenantId: data.tenantId,
      leaseType: data.leaseType as LeaseType,
      leaseTemplateId: selectedTemplateId || null,
      startDate: data.startDate,
      durationMonths: parseInt(data.durationMonths) || 36,
      baseRentHT: parseFloat(data.baseRentHT),
      depositAmount: parseFloat(data.depositAmount) || 0,
      paymentFrequency: data.paymentFrequency as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
      billingTerm: (data.billingTerm as "ECHU" | "A_ECHOIR") || "A_ECHOIR",
      vatApplicable: data.vatApplicable === "on",
      vatRate: parseFloat(data.vatRate) || 0,
      indexType: (data.indexType as "IRL" | "ILC" | "ILAT" | "ICC") || null,
      baseIndexValue: data.baseIndexValue ? parseFloat(data.baseIndexValue) : null,
      baseIndexQuarter: data.baseIndexQuarter || null,
      revisionFrequency: parseInt(data.revisionFrequency) || 12,
      rentFreeMonths: parseFloat(data.rentFreeMonths) || 0,
      entryFee: parseFloat(data.entryFee) || 0,
      tenantWorksClauses: data.tenantWorksClauses || null,
      isThirdPartyManaged,
      ...(isThirdPartyManaged
        ? {
            managingContactId: managingContactId || undefined,
            managementFeeType,
            managementFeeValue,
            managementFeeBasis: managementFeeType === "POURCENTAGE" ? managementFeeBasis : undefined,
            managementFeeVatRate,
          }
        : {}),
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/baux/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/baux">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau bail</h1>
          <p className="text-muted-foreground">Créer un bail</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Parties */}
        <Card>
          <CardHeader>
            <CardTitle>Parties au bail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lotId">Lot *</Label>
              <select
                id="lotId"
                name="lotId"
                defaultValue={defaultLotId}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sélectionner un lot vacant...</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {lotLabel(l)}
                  </option>
                ))}
              </select>
              {lots.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun lot vacant disponible.{" "}
                  <Link href="/patrimoine/immeubles" className="underline">
                    Gérer les lots
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantId">Locataire *</Label>
              <select
                id="tenantId"
                name="tenantId"
                defaultValue={defaultTenantId}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Sélectionner un locataire...</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {tenantLabel(t)} — {t.email}
                  </option>
                ))}
              </select>
              {tenants.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun locataire actif.{" "}
                  <Link href="/locataires/nouveau" className="underline">
                    Créer un locataire
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Type et durée */}
        <Card>
          <CardHeader>
            <CardTitle>Type et durée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leaseType">Type de bail *</Label>
                <select
                  id="leaseType"
                  name="leaseType"
                  value={leaseType}
                  onChange={(e) => handleLeaseTypeChange(e.target.value as LeaseType)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="leaseTemplate">Modele de bail</Label>
                  <select
                    id="leaseTemplate"
                    value={selectedTemplateId}
                    onChange={(e) => {
                      const tpl = templates.find((t) => t.id === e.target.value);
                      if (tpl) applyTemplate(tpl);
                      else setSelectedTemplateId("");
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Sans modele</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.isDefault ? " (par defaut)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    <Link href="/baux/modeles" className="underline">Gerer les modeles</Link>
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Durée (mois) *</Label>
                <Input
                  id="durationMonths"
                  name="durationMonths"
                  type="number"
                  min={1}
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Date de début *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentFrequency">Fréquence de paiement</Label>
                <NativeSelect
                  id="paymentFrequency"
                  name="paymentFrequency"
                  options={PAYMENT_FREQUENCIES}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billingTerm">Terme de facturation</Label>
                <NativeSelect
                  id="billingTerm"
                  name="billingTerm"
                  options={BILLING_TERMS}
                  defaultValue="A_ECHOIR"
                />
                <p className="text-xs text-muted-foreground">
                  À échoir : le loyer est dû au début de la période couverte.
                  Échu : le loyer est dû après la période.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loyer */}
        <Card>
          <CardHeader>
            <CardTitle>Loyer et dépôt de garantie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="baseRentHT">Loyer HT (€/{FREQ_PERIOD_LABELS[frequency] ?? "mois"}) *</Label>
                <Input
                  id="baseRentHT"
                  name="baseRentHT"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositAmount">Dépôt de garantie (€)</Label>
                <Input
                  id="depositAmount"
                  name="depositAmount"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="vatApplicable"
                name="vatApplicable"
                checked={vatApplicable}
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
                    defaultValue={20}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rentFreeMonths">Franchise de loyer (mois)</Label>
                <Input
                  id="rentFreeMonths"
                  name="rentFreeMonths"
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryFee">Pas-de-porte (€)</Label>
                <Input
                  id="entryFee"
                  name="entryFee"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={0}
                />
              </div>
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
                  value={indexType}
                  onChange={(e) => setIndexType(e.target.value)}
                  placeholder="Sans indexation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseIndexValue">Valeur de référence</Label>
                <Input
                  id="baseIndexValue"
                  name="baseIndexValue"
                  type="number"
                  step={0.01}
                  placeholder="Ex: 132.45"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseIndexQuarter">Trimestre de référence</Label>
                <Input
                  id="baseIndexQuarter"
                  name="baseIndexQuarter"
                  placeholder="Ex: T1 2024"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="revisionFrequency">Fréquence de révision (mois)</Label>
              <Input
                id="revisionFrequency"
                name="revisionFrequency"
                type="number"
                min={1}
                defaultValue={12}
                className="w-32"
              />
            </div>
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
              Confiez la gestion de ce bail a une agence ou un tiers
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
                    placeholder="Selectionner une agence..."
                  />
                  {agencies.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aucune agence trouvee.{" "}
                      <Link href="/contacts" className="underline">
                        Gerer les contacts
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
                        : "Montant (EUR)"}
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
          <Link href="/baux">
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              "Créer le bail"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
