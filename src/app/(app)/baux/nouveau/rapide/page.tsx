"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createLease } from "@/actions/lease";
import { getActiveTenants } from "@/actions/tenant";
import { getLots } from "@/actions/lot";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useSociety } from "@/providers/society-provider";
import {
  getDefaultDuration,
  getDefaultIndexType,
  getDefaultVat,
  type LeaseType,
  type CreateLeaseInput,
} from "@/validations/lease";
import { toast } from "sonner";

// ── Options statiques ─────────────────────────────────────────────

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
  { value: "A_ECHOIR", label: "Terme à échoir (début de période)" },
  { value: "ECHU", label: "Terme échu (fin de période)" },
];

const INDEX_TYPES = [
  { value: "IRL", label: "IRL — Indice de Référence des Loyers" },
  { value: "ILC", label: "ILC — Indice des Loyers Commerciaux" },
  { value: "ILAT", label: "ILAT — Indice des Loyers des Activités Tertiaires" },
  { value: "ICC", label: "ICC — Indice du Coût de la Construction" },
];

const REVISION_DATE_BASIS_OPTIONS = [
  { value: "DATE_SIGNATURE", label: "Date anniversaire du bail" },
  { value: "DATE_ENTREE", label: "Date d'entrée dans les lieux" },
  { value: "PREMIER_JANVIER", label: "1er janvier de chaque exercice" },
  { value: "DATE_PERSONNALISEE", label: "Date personnalisée" },
];

const FEE_BASIS_OPTIONS = [
  { value: "LOYER_HT", label: "Loyer HT seul" },
  { value: "LOYER_CHARGES_HT", label: "Loyer + charges HT" },
  { value: "TOTAL_TTC", label: "Total TTC" },
];

type LotOption = {
  id: string;
  number: string;
  lotType: string;
  area: number;
  status: string;
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

function tenantLabel(tenant: TenantOption) {
  return tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? tenant.email)
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || tenant.email;
}

export default function BailRapidePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();

  // ── État ──
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lots, setLots] = useState<LotOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [leaseType, setLeaseType] = useState<LeaseType>("HABITATION");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationMonths, setDurationMonths] = useState(36);
  const [frequency, setFrequency] = useState("MENSUEL");
  const [vatApplicable, setVatApplicable] = useState(false);
  const [vatRate, setVatRate] = useState("20");
  const [baseRentHT, setBaseRentHT] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [indexType, setIndexType] = useState<string>("IRL");
  const [baseIndexValue, setBaseIndexValue] = useState("");
  const [baseIndexQuarter, setBaseIndexQuarter] = useState("");
  const [revisionFrequency, setRevisionFrequency] = useState("12");
  const [revisionDateBasis, setRevisionDateBasis] = useState("DATE_SIGNATURE");
  const [revisionCustomMonth, setRevisionCustomMonth] = useState("1");
  const [revisionCustomDay, setRevisionCustomDay] = useState("1");
  const [rentFreeMonths, setRentFreeMonths] = useState("0");
  const [entryFee, setEntryFee] = useState("0");
  const [tenantWorksClauses, setTenantWorksClauses] = useState("");
  const [isThirdPartyManaged, setIsThirdPartyManaged] = useState(false);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [managingContactId, setManagingContactId] = useState("");
  const [managementFeeType, setManagementFeeType] = useState<"POURCENTAGE" | "FORFAIT">("POURCENTAGE");
  const [managementFeeValue, setManagementFeeValue] = useState<number>(0);
  const [managementFeeBasis, setManagementFeeBasis] = useState<"LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC">("LOYER_HT");
  const [managementFeeVatRate, setManagementFeeVatRate] = useState<number>(20);

  const defaultLotId = searchParams.get("lotId") ?? "";
  const defaultTenantId = searchParams.get("tenantId") ?? "";

  // ── Effets ──
  useEffect(() => {
    if (defaultLotId && selectedLotIds.length === 0) setSelectedLotIds([defaultLotId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLotId]);

  useEffect(() => {
    if (defaultTenantId && !tenantId) setTenantId(defaultTenantId);
  }, [defaultTenantId, tenantId]);

  useEffect(() => {
    if (!activeSociety) return;
    const sid = activeSociety.id;
    async function fetchOptions() {
      const [tenantList, lotList] = await Promise.all([
        getActiveTenants(sid),
        getLots(sid),
      ]);
      setTenants(tenantList);
      setLots(
        lotList.map((lot) => ({
          id: lot.id,
          number: lot.number,
          lotType: lot.lotType,
          area: lot.area,
          status: lot.status,
          building: { id: lot.building.id, name: lot.building.name, city: lot.building.city },
        }))
      );
    }
    void fetchOptions();
  }, [activeSociety]);

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

  function handleLeaseTypeChange(type: LeaseType) {
    setLeaseType(type);
    setSelectedTemplateId("");
    setDurationMonths(getDefaultDuration(type));
    const vat = getDefaultVat(type);
    setVatApplicable(vat.applicable);
    const idx = getDefaultIndexType(type);
    setIndexType(idx ?? "");
    if (activeSociety) {
      fetch(`/api/lease-templates?leaseType=${type}`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json: { data: TemplateOption[] }) => {
          setTemplates(json.data);
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

  function lotLabel(l: LotOption) {
    return `${l.building.name} — Lot ${l.number} (${l.area} m²) — ${l.building.city}`;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) { setError("Aucune société sélectionnée"); return; }
    if (selectedLotIds.length === 0) { setError("Sélectionnez au moins un lot"); return; }

    setError("");
    setIsLoading(true);

    const result = await createLease(activeSociety.id, {
      lotIds: selectedLotIds,
      tenantId,
      leaseType,
      destination: (destination || null) as CreateLeaseInput["destination"],
      leaseTemplateId: selectedTemplateId || null,
      startDate,
      durationMonths,
      baseRentHT: parseFloat(baseRentHT),
      depositAmount: parseFloat(depositAmount) || 0,
      paymentFrequency: frequency as "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL",
      billingTerm: "A_ECHOIR",
      vatApplicable,
      vatRate: parseFloat(vatRate) || 0,
      indexType: (indexType as "IRL" | "ILC" | "ILAT" | "ICC") || null,
      baseIndexValue: baseIndexValue ? parseFloat(baseIndexValue) : null,
      baseIndexQuarter: baseIndexQuarter || null,
      revisionFrequency: parseInt(revisionFrequency) || 12,
      revisionDateBasis: revisionDateBasis as "DATE_SIGNATURE" | "DATE_ENTREE" | "PREMIER_JANVIER" | "DATE_PERSONNALISEE",
      revisionCustomMonth: revisionCustomMonth ? parseInt(revisionCustomMonth) : null,
      revisionCustomDay: revisionCustomDay ? parseInt(revisionCustomDay) : null,
      rentFreeMonths: parseFloat(rentFreeMonths) || 0,
      entryFee: parseFloat(entryFee) || 0,
      tenantWorksClauses: tenantWorksClauses || null,
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

    if (result.success && result.data) {
      toast.success("Bail créé avec succès");
      router.push(`/baux/${result.data.id}`);
    } else {
      setIsLoading(false);
      setError(result.error ?? "Erreur inconnue");
    }
  }

  const vacantLots = lots.filter((l) => l.status === "VACANT");

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/baux/nouveau">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bail rapide</h1>
          <p className="text-muted-foreground">
            Sélectionnez un lot et un locataire existants puis renseignez les conditions
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Parties au bail ──────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Parties au bail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Lot(s) concerné(s) *</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Sélectionnez un ou plusieurs lots. Le premier coché sera le lot principal.
              </p>
              {vacantLots.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun lot vacant disponible.{" "}
                  <Link href="/patrimoine/lots" className="underline">Gérer les lots</Link>
                </p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                  {vacantLots.map((lot) => {
                    const checked = selectedLotIds.includes(lot.id);
                    return (
                      <label
                        key={lot.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          checked ? "bg-primary/5 font-medium" : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedLotIds((prev) =>
                              prev.includes(lot.id)
                                ? prev.filter((id) => id !== lot.id)
                                : [...prev, lot.id]
                            )
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="truncate">{lotLabel(lot)}</span>
                        {checked && selectedLotIds[0] === lot.id && (
                          <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                            Principal
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantId">Locataire *</Label>
              <select
                id="tenantId"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
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
                  <Link href="/locataires/nouveau" className="underline">Créer un locataire</Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Type et durée ────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Type et durée</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leaseType">Type de bail *</Label>
                <select
                  id="leaseType"
                  value={leaseType}
                  onChange={(e) => handleLeaseTypeChange(e.target.value as LeaseType)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {LEASE_TYPE_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">Destination des locaux</Label>
                <NativeSelect id="destination" options={DESTINATION_OPTIONS} value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Modèle de bail</Label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => {
                      const tpl = templates.find((t) => t.id === e.target.value);
                      if (tpl) applyTemplate(tpl); else setSelectedTemplateId("");
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Sans modèle</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (par défaut)" : ""}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    <Link href="/baux/modeles" className="underline">Gérer les modèles</Link>
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Durée (mois) *</Label>
                <Input id="durationMonths" type="number" min={1} value={durationMonths} onChange={(e) => setDurationMonths(parseInt(e.target.value) || 1)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Date de début *</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Fréquence de paiement</Label>
                <NativeSelect options={PAYMENT_FREQUENCIES} value={frequency} onChange={(e) => setFrequency(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Terme de facturation</Label>
                <NativeSelect options={BILLING_TERMS} defaultValue="A_ECHOIR" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Loyer et dépôt ──────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Loyer et dépôt de garantie</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="baseRentHT">Loyer HT (€/{FREQ_PERIOD_LABELS[frequency] ?? "mois"}) *</Label>
                <Input id="baseRentHT" type="number" min={0} step={0.01} placeholder="0.00" value={baseRentHT} onChange={(e) => setBaseRentHT(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositAmount">Dépôt de garantie (€)</Label>
                <Input id="depositAmount" type="number" min={0} step={0.01} placeholder="0.00" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="vatApplicable" checked={vatApplicable} className="h-4 w-4 rounded border-input" onChange={(e) => setVatApplicable(e.target.checked)} />
              <Label htmlFor="vatApplicable">TVA applicable</Label>
              {vatApplicable && (
                <div className="flex items-center gap-2 ml-4">
                  <Label htmlFor="vatRate">Taux</Label>
                  <Input id="vatRate" type="number" min={0} max={100} step={0.1} value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-20" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              )}
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rentFreeMonths">Franchise de loyer (mois)</Label>
                <Input id="rentFreeMonths" type="number" min={0} step={0.5} value={rentFreeMonths} onChange={(e) => setRentFreeMonths(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryFee">Pas-de-porte (€)</Label>
                <Input id="entryFee" type="number" min={0} step={0.01} value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Indexation ───────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Indexation</CardTitle>
            <CardDescription>Indice de révision du loyer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Indice de référence</Label>
                <NativeSelect options={INDEX_TYPES} value={indexType} onChange={(e) => setIndexType(e.target.value)} placeholder="Sans indexation" />
              </div>
              <div className="space-y-2">
                <Label>Valeur de référence</Label>
                <Input type="number" step={0.01} placeholder="Ex: 132.45" value={baseIndexValue} onChange={(e) => setBaseIndexValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Trimestre de référence</Label>
                <Input placeholder="Ex: T1 2024" value={baseIndexQuarter} onChange={(e) => setBaseIndexQuarter(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fréquence de révision (mois)</Label>
                <Input type="number" min={1} value={revisionFrequency} onChange={(e) => setRevisionFrequency(e.target.value)} className="w-32" />
              </div>
              <div className="space-y-2">
                <Label>Date de révision</Label>
                <NativeSelect options={REVISION_DATE_BASIS_OPTIONS} value={revisionDateBasis} onChange={(e) => setRevisionDateBasis(e.target.value)} />
              </div>
            </div>
            {revisionDateBasis === "DATE_PERSONNALISEE" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Jour</Label>
                  <Input type="number" min={1} max={31} value={revisionCustomDay} onChange={(e) => setRevisionCustomDay(e.target.value)} className="w-24" />
                </div>
                <div className="space-y-2">
                  <Label>Mois</Label>
                  <NativeSelect
                    options={[
                      { value: "1", label: "Janvier" }, { value: "2", label: "Février" },
                      { value: "3", label: "Mars" }, { value: "4", label: "Avril" },
                      { value: "5", label: "Mai" }, { value: "6", label: "Juin" },
                      { value: "7", label: "Juillet" }, { value: "8", label: "Août" },
                      { value: "9", label: "Septembre" }, { value: "10", label: "Octobre" },
                      { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" },
                    ]}
                    value={revisionCustomMonth}
                    onChange={(e) => setRevisionCustomMonth(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Clauses ──────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Clauses particulières</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="tenantWorksClauses">Travaux et aménagements autorisés</Label>
              <Textarea
                id="tenantWorksClauses"
                rows={3}
                placeholder="Travaux autorisés, conditions de restitution des lieux..."
                value={tenantWorksClauses}
                onChange={(e) => setTenantWorksClauses(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Gestion tiers ────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Gestion tiers</CardTitle>
            <CardDescription>Confiez la gestion de ce bail à une agence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isThirdPartyManaged" checked={isThirdPartyManaged} className="h-4 w-4 rounded border-input" onChange={(e) => setIsThirdPartyManaged(e.target.checked)} />
              <Label htmlFor="isThirdPartyManaged">Bail sous gestion tiers</Label>
            </div>
            {isThirdPartyManaged && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Agence de gestion</Label>
                  <NativeSelect
                    options={agencies.map((a) => ({ value: a.id, label: a.company ? `${a.name} — ${a.company}` : a.name }))}
                    value={managingContactId}
                    onChange={(e) => setManagingContactId(e.target.value)}
                    placeholder="Sélectionner une agence..."
                  />
                  {agencies.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aucune agence trouvée. <Link href="/contacts" className="underline">Gérer les contacts</Link>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Type d&apos;honoraires</Label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={managementFeeType === "POURCENTAGE"} onChange={() => setManagementFeeType("POURCENTAGE")} className="h-4 w-4" />
                      Pourcentage
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={managementFeeType === "FORFAIT"} onChange={() => setManagementFeeType("FORFAIT")} className="h-4 w-4" />
                      Forfait
                    </label>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{managementFeeType === "POURCENTAGE" ? "Taux (%)" : "Montant (€)"}</Label>
                    <Input type="number" min={0} step={managementFeeType === "POURCENTAGE" ? 0.1 : 0.01} value={managementFeeValue} onChange={(e) => setManagementFeeValue(parseFloat(e.target.value) || 0)} />
                  </div>
                  {managementFeeType === "POURCENTAGE" && (
                    <div className="space-y-2">
                      <Label>Base de calcul</Label>
                      <NativeSelect options={FEE_BASIS_OPTIONS} value={managementFeeBasis} onChange={(e) => setManagementFeeBasis(e.target.value as "LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC")} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Taux de TVA sur honoraires (%)</Label>
                  <Input type="number" min={0} max={100} step={0.1} value={managementFeeVatRate} onChange={(e) => setManagementFeeVatRate(parseFloat(e.target.value) || 0)} className="w-32" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Actions ──────────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <Link href="/baux/nouveau">
            <Button variant="outline" type="button">Annuler</Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Création...</>
            ) : (
              "Créer le bail"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
