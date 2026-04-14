"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { importFromPdf, type ImportInput } from "@/actions/import";
import { getBuildings } from "@/actions/building";
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
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Layers,
  Loader2,
  Users,
} from "lucide-react";
import { useSociety } from "@/providers/society-provider";
import { cn } from "@/lib/utils";
import {
  getDefaultDuration,
  getDefaultIndexType,
  getDefaultVat,
  type LeaseType,
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
  MENSUEL: "mois", TRIMESTRIEL: "trimestre", SEMESTRIEL: "semestre", ANNUEL: "an",
};

const BILLING_TERMS = [
  { value: "A_ECHOIR", label: "Terme à échoir (début de période)" },
  { value: "ECHU", label: "Terme échu (fin de période)" },
];

const INDEX_TYPES_LIST = [
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

const BUILDING_TYPE_OPTIONS = [
  { value: "BUREAU", label: "Bureau" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "MIXTE", label: "Mixte" },
  { value: "ENTREPOT", label: "Entrepôt" },
];

const LOT_TYPE_OPTIONS = [
  { value: "LOCAL_COMMERCIAL", label: "Local commercial" },
  { value: "BUREAUX", label: "Bureaux" },
  { value: "LOCAL_ACTIVITE", label: "Local d'activité" },
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "ENTREPOT", label: "Entrepôt" },
  { value: "PARKING", label: "Parking" },
  { value: "CAVE", label: "Cave" },
  { value: "TERRASSE", label: "Terrasse" },
  { value: "RESERVE", label: "Réserve" },
];

const LEGAL_FORM_OPTIONS = [
  { value: "", label: "— Forme juridique —" },
  { value: "SAS", label: "SAS" }, { value: "SARL", label: "SARL" },
  { value: "SA", label: "SA" }, { value: "SCI", label: "SCI" },
  { value: "EURL", label: "EURL" }, { value: "SASU", label: "SASU" },
  { value: "SNC", label: "SNC" },
  { value: "EI", label: "Entreprise individuelle" },
  { value: "AUTRE", label: "Autre" },
];

const FEE_BASIS_OPTIONS = [
  { value: "LOYER_HT", label: "Loyer HT seul" },
  { value: "LOYER_CHARGES_HT", label: "Loyer + charges HT" },
  { value: "TOTAL_TTC", label: "Total TTC" },
];

// ── Types ──────────────────────────────────────────────────────────

type BuildingOption = { id: string; name: string; city: string };
type LotOption = { id: string; number: string; lotType: string; area: number; status: string; building: { id: string; name: string; city: string } };
type TenantOption = { id: string; entityType: string; companyName?: string | null; firstName?: string | null; lastName?: string | null; email: string };
type AgencyOption = { id: string; name: string; company?: string | null };

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS: Record<Step, string> = {
  1: "Immeuble & Lot",
  2: "Locataire",
  3: "Conditions du bail",
  4: "Récapitulatif",
};

type BuildingForm = { name: string; addressLine1: string; city: string; postalCode: string; buildingType: string };
type LotForm = { number: string; lotType: string; area: string; floor: string; position: string };
type TenantForm = {
  entityType: "PERSONNE_MORALE" | "PERSONNE_PHYSIQUE";
  companyName: string; companyLegalForm: string; siret: string;
  legalRepName: string; legalRepTitle: string; legalRepEmail: string; legalRepPhone: string;
  firstName: string; lastName: string; email: string; phone: string; mobile: string;
};

function emptyBuildingForm(): BuildingForm {
  return { name: "", addressLine1: "", city: "", postalCode: "", buildingType: "COMMERCE" };
}

function emptyLotForm(): LotForm {
  return { number: "", lotType: "LOCAL_COMMERCIAL", area: "", floor: "", position: "" };
}

function emptyTenantForm(): TenantForm {
  return {
    entityType: "PERSONNE_MORALE", companyName: "", companyLegalForm: "", siret: "",
    legalRepName: "", legalRepTitle: "", legalRepEmail: "", legalRepPhone: "",
    firstName: "", lastName: "", email: "", phone: "", mobile: "",
  };
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function tenantLabel(t: TenantOption) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? t.email)
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.email;
}

// ── Composant principal ────────────────────────────────────────────

export default function BailCompletPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();

  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Données
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [lots, setLots] = useState<LotOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  // Étape 1 — Immeuble & Lot
  const [useExistingBuilding, setUseExistingBuilding] = useState(false);
  const [existingBuildingId, setExistingBuildingId] = useState("");
  const [buildingForm, setBuildingForm] = useState<BuildingForm>(emptyBuildingForm());
  const [useExistingLot, setUseExistingLot] = useState(false);
  const [existingLotId, setExistingLotId] = useState("");
  const [lotForm, setLotForm] = useState<LotForm>(emptyLotForm());
  const [secondaryLotIds, setSecondaryLotIds] = useState<string[]>([]);

  // Étape 2 — Locataire
  const [useExistingTenant, setUseExistingTenant] = useState(false);
  const [existingTenantId, setExistingTenantId] = useState("");
  const [tenantForm, setTenantForm] = useState<TenantForm>(emptyTenantForm());

  // Étape 3 — Conditions
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
  const [managementFeeType] = useState<"POURCENTAGE" | "FORFAIT">("POURCENTAGE");
  const [managementFeeValue, setManagementFeeValue] = useState<number>(0);
  const [managementFeeBasis, setManagementFeeBasis] = useState<"LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC">("LOYER_HT");
  const [managementFeeVatRate] = useState<number>(20);

  // ── Fetch données ──
  useEffect(() => {
    if (!activeSociety) return;
    const sid = activeSociety.id;
    async function fetchOptions() {
      const [buildingList, tenantList, lotList] = await Promise.all([
        getBuildings(sid), getActiveTenants(sid), getLots(sid),
      ]);
      setBuildings(buildingList.map((b) => ({ id: b.id, name: b.name, city: b.city })));
      setTenants(tenantList);
      setLots(lotList.map((l) => ({
        id: l.id, number: l.number, lotType: l.lotType, area: l.area, status: l.status,
        building: { id: l.building.id, name: l.building.name, city: l.building.city },
      })));
    }
    void fetchOptions();
  }, [activeSociety]);

  useEffect(() => {
    if (!isThirdPartyManaged) return;
    fetch("/api/contacts?type=AGENCE")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data: AgencyOption[] }) => setAgencies(json.data ?? []))
      .catch(() => setAgencies([]));
  }, [isThirdPartyManaged]);

  // Synchroniser lot ↔ immeuble (appelé dans le handler onChange du lot)
  function syncBuildingFromLot(lotId: string): void {
    if (!lotId) return;
    const selected = lots.find((l) => l.id === lotId);
    if (selected && existingBuildingId !== selected.building.id) {
      setExistingBuildingId(selected.building.id);
      setUseExistingBuilding(true);
    }
  }

  function handleLeaseTypeChange(type: LeaseType) {
    setLeaseType(type);
    setDurationMonths(getDefaultDuration(type));
    const vat = getDefaultVat(type);
    setVatApplicable(vat.applicable);
    const idx = getDefaultIndexType(type);
    setIndexType(idx ?? "");
  }

  const existingLotsForBuilding = useExistingBuilding && existingBuildingId
    ? lots.filter((l) => l.status === "VACANT" && l.building.id === existingBuildingId)
    : lots.filter((l) => l.status === "VACANT");

  const availableSecondaryLots = existingLotsForBuilding.filter((l) => l.id !== existingLotId);

  // ── Validation par étape ──

  function validateStep1(): string | null {
    if (!useExistingBuilding) {
      if (!buildingForm.name) return "Nom de l'immeuble requis";
      if (!buildingForm.addressLine1) return "Adresse requise";
      if (!buildingForm.city) return "Ville requise";
      if (!buildingForm.postalCode) return "Code postal requis";
    } else if (!existingBuildingId) return "Sélectionnez un immeuble";
    if (!useExistingLot) {
      if (!lotForm.number) return "Numéro de lot requis";
      if (!lotForm.area || Number.isNaN(parseFloat(lotForm.area))) return "Surface requise";
    } else if (!existingLotId) return "Sélectionnez un lot";
    return null;
  }

  function validateStep2(): string | null {
    if (!useExistingTenant) {
      if (!tenantForm.email) return "Email du locataire requis";
      if (tenantForm.entityType === "PERSONNE_MORALE" && !tenantForm.companyName) return "Raison sociale requise";
      if (tenantForm.entityType === "PERSONNE_PHYSIQUE" && (!tenantForm.firstName || !tenantForm.lastName)) return "Prénom et nom requis";
    } else if (!existingTenantId) return "Sélectionnez un locataire";
    return null;
  }

  function validateStep3(): string | null {
    if (!startDate) return "Date de début requise";
    if (!baseRentHT || Number.isNaN(parseFloat(baseRentHT))) return "Loyer HT requis";
    return null;
  }

  function goNext() {
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (step === 3) err = validateStep3();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => Math.min(s + 1, 4) as Step);
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 1) as Step);
  }

  // ── Submit ──

  async function handleSubmit() {
    if (!activeSociety) { setError("Aucune société sélectionnée"); return; }
    const err3 = validateStep3();
    if (err3) { setError(err3); return; }

    setError("");
    setIsLoading(true);

    const input: ImportInput = {
      building: {
        existingId: useExistingBuilding ? existingBuildingId : undefined,
        name: buildingForm.name,
        addressLine1: buildingForm.addressLine1,
        city: buildingForm.city,
        postalCode: buildingForm.postalCode,
        buildingType: buildingForm.buildingType as ImportInput["building"]["buildingType"],
      },
      lot: {
        existingId: useExistingLot ? existingLotId : undefined,
        number: lotForm.number,
        lotType: lotForm.lotType as ImportInput["lot"]["lotType"],
        area: parseFloat(lotForm.area),
        floor: lotForm.floor || null,
        position: lotForm.position || null,
      },
      tenant: {
        existingId: useExistingTenant ? existingTenantId : undefined,
        entityType: tenantForm.entityType,
        companyName: tenantForm.companyName || null,
        companyLegalForm: tenantForm.companyLegalForm || null,
        siret: tenantForm.siret || null,
        legalRepName: tenantForm.legalRepName || null,
        legalRepTitle: tenantForm.legalRepTitle || null,
        legalRepEmail: tenantForm.legalRepEmail || null,
        legalRepPhone: tenantForm.legalRepPhone || null,
        firstName: tenantForm.firstName || null,
        lastName: tenantForm.lastName || null,
        email: tenantForm.email,
        phone: tenantForm.phone || null,
        mobile: tenantForm.mobile || null,
      },
      lease: {
        leaseType,
        destination: (destination || null) as ImportInput["lease"]["destination"],
        startDate,
        durationMonths,
        baseRentHT: parseFloat(baseRentHT),
        depositAmount: depositAmount ? parseFloat(depositAmount) : 0,
        paymentFrequency: frequency as ImportInput["lease"]["paymentFrequency"],
        vatApplicable,
        vatRate: vatRate ? parseFloat(vatRate) : 0,
        indexType: (indexType || null) as ImportInput["lease"]["indexType"],
        baseIndexValue: baseIndexValue ? parseFloat(baseIndexValue) : null,
        baseIndexQuarter: baseIndexQuarter || null,
        revisionFrequency: revisionFrequency ? parseInt(revisionFrequency) : 12,
        revisionDateBasis: revisionDateBasis as ImportInput["lease"]["revisionDateBasis"],
        revisionCustomMonth: revisionCustomMonth ? parseInt(revisionCustomMonth) : null,
        revisionCustomDay: revisionCustomDay ? parseInt(revisionCustomDay) : null,
        rentFreeMonths: rentFreeMonths ? parseFloat(rentFreeMonths) : 0,
        entryFee: entryFee ? parseFloat(entryFee) : 0,
        tenantWorksClauses: tenantWorksClauses || null,
        isThirdPartyManaged,
        managingContactId: isThirdPartyManaged ? managingContactId || null : null,
        managementFeeType: isThirdPartyManaged ? managementFeeType : null,
        managementFeeValue: isThirdPartyManaged ? managementFeeValue : null,
        managementFeeBasis: isThirdPartyManaged && managementFeeType === "POURCENTAGE" ? managementFeeBasis : null,
        managementFeeVatRate: isThirdPartyManaged ? managementFeeVatRate : null,
      },
      secondaryLotIds,
    };

    const result = await importFromPdf(activeSociety.id, input);

    if (result.success && result.data) {
      toast.success("Bail créé avec succès (immeuble, lot et locataire rattachés).");
      router.push(`/baux/${result.data.leaseId}`);
    } else {
      setIsLoading(false);
      setError(result.error ?? "Erreur lors de la création");
    }
  }

  // ── Rendu ──

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/baux/nouveau">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bail complet</h1>
          <p className="text-muted-foreground">
            Créez l&apos;immeuble, le lot, le locataire et le bail en une opération
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { if (s < step) { setError(""); setStep(s); } }}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              step === s
                ? "bg-primary text-primary-foreground"
                : s < step
                  ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {s < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-bold">{s}</span>}
            <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
          </button>
        ))}
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {/* ────────────── Étape 1 : Immeuble & Lot ──────────────── */}
      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Immeuble */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-blue-500" /> Immeuble
              </CardTitle>
              {buildings.length > 0 && (
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useExistingBuilding} onChange={() => { setUseExistingBuilding((c) => !c); setExistingBuildingId(""); }} className="h-4 w-4" />
                  Utiliser un immeuble existant
                </label>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {useExistingBuilding ? (
                <FieldRow label="Immeuble *">
                  <NativeSelect
                    value={existingBuildingId}
                    onChange={(e) => { setExistingBuildingId(e.target.value); setUseExistingBuilding(Boolean(e.target.value)); }}
                    options={buildings.map((b) => ({ value: b.id, label: `${b.name} — ${b.city}` }))}
                    placeholder="— Sélectionner —"
                  />
                </FieldRow>
              ) : (
                <>
                  <FieldRow label="Nom *">
                    <Input value={buildingForm.name} onChange={(e) => setBuildingForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex : Immeuble du Centre" className="h-8 text-sm" />
                  </FieldRow>
                  <FieldRow label="Adresse *">
                    <Input value={buildingForm.addressLine1} onChange={(e) => setBuildingForm((f) => ({ ...f, addressLine1: e.target.value }))} placeholder="12 rue de la Paix" className="h-8 text-sm" />
                  </FieldRow>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Ville *">
                      <Input value={buildingForm.city} onChange={(e) => setBuildingForm((f) => ({ ...f, city: e.target.value }))} className="h-8 text-sm" />
                    </FieldRow>
                    <FieldRow label="Code postal *">
                      <Input value={buildingForm.postalCode} onChange={(e) => setBuildingForm((f) => ({ ...f, postalCode: e.target.value }))} className="h-8 text-sm" />
                    </FieldRow>
                  </div>
                  <FieldRow label="Type *">
                    <NativeSelect value={buildingForm.buildingType} onChange={(e) => setBuildingForm((f) => ({ ...f, buildingType: e.target.value }))} options={BUILDING_TYPE_OPTIONS} />
                  </FieldRow>
                </>
              )}
            </CardContent>
          </Card>

          {/* Lot */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4 text-emerald-500" /> Lot
              </CardTitle>
              {existingLotsForBuilding.length > 0 && (
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useExistingLot} onChange={() => { setUseExistingLot((c) => !c); setExistingLotId(""); }} className="h-4 w-4" />
                  Utiliser un lot existant
                </label>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {useExistingLot ? (
                <FieldRow label="Lot *">
                  <NativeSelect
                    value={existingLotId}
                    onChange={(e) => { setExistingLotId(e.target.value); setUseExistingLot(Boolean(e.target.value)); syncBuildingFromLot(e.target.value); }}
                    options={existingLotsForBuilding.map((l) => ({ value: l.id, label: `Lot ${l.number} — ${l.lotType} (${l.area} m²)` }))}
                    placeholder="— Sélectionner —"
                  />
                </FieldRow>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Numéro *">
                      <Input value={lotForm.number} onChange={(e) => setLotForm((f) => ({ ...f, number: e.target.value }))} placeholder="A1" className="h-8 text-sm" />
                    </FieldRow>
                    <FieldRow label="Surface (m²) *">
                      <Input type="number" value={lotForm.area} onChange={(e) => setLotForm((f) => ({ ...f, area: e.target.value }))} placeholder="120" className="h-8 text-sm" />
                    </FieldRow>
                  </div>
                  <FieldRow label="Type *">
                    <NativeSelect value={lotForm.lotType} onChange={(e) => setLotForm((f) => ({ ...f, lotType: e.target.value }))} options={LOT_TYPE_OPTIONS} />
                  </FieldRow>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Étage">
                      <Input value={lotForm.floor} onChange={(e) => setLotForm((f) => ({ ...f, floor: e.target.value }))} placeholder="RDC" className="h-8 text-sm" />
                    </FieldRow>
                    <FieldRow label="Position">
                      <Input value={lotForm.position} onChange={(e) => setLotForm((f) => ({ ...f, position: e.target.value }))} placeholder="Aile droite" className="h-8 text-sm" />
                    </FieldRow>
                  </div>
                </>
              )}

              {/* Lots secondaires */}
              {availableSecondaryLots.length > 0 && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <Label className="text-xs text-muted-foreground">Lots secondaires (optionnel)</Label>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                    {availableSecondaryLots.map((lot) => {
                      const checked = secondaryLotIds.includes(lot.id);
                      return (
                        <label key={lot.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs", checked ? "bg-primary/5 font-medium" : "hover:bg-muted/50")}>
                          <input type="checkbox" checked={checked} onChange={() => setSecondaryLotIds((c) => c.includes(lot.id) ? c.filter((id) => id !== lot.id) : [...c, lot.id])} className="h-3.5 w-3.5" />
                          Lot {lot.number} — {lot.lotType} ({lot.area} m²)
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ────────────── Étape 2 : Locataire ──────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-purple-500" /> Locataire
            </CardTitle>
            {tenants.length > 0 && (
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useExistingTenant} onChange={() => { setUseExistingTenant((c) => !c); setExistingTenantId(""); }} className="h-4 w-4" />
                Utiliser un locataire existant
              </label>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {useExistingTenant ? (
              <FieldRow label="Locataire *">
                <NativeSelect
                  value={existingTenantId}
                  onChange={(e) => { setExistingTenantId(e.target.value); setUseExistingTenant(Boolean(e.target.value)); }}
                  options={tenants.map((t) => ({ value: t.id, label: `${tenantLabel(t)} — ${t.email}` }))}
                  placeholder="— Sélectionner —"
                />
              </FieldRow>
            ) : (
              <>
                <div className="flex gap-2">
                  {(["PERSONNE_MORALE", "PERSONNE_PHYSIQUE"] as const).map((type) => (
                    <button key={type} type="button" onClick={() => setTenantForm((f) => ({ ...f, entityType: type }))}
                      className={cn("flex-1 rounded-md border py-1.5 text-xs transition-colors",
                        tenantForm.entityType === type ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:bg-accent"
                      )}>
                      {type === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}
                    </button>
                  ))}
                </div>

                {tenantForm.entityType === "PERSONNE_MORALE" ? (
                  <>
                    <FieldRow label="Raison sociale *">
                      <Input value={tenantForm.companyName} onChange={(e) => setTenantForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Société ACME" className="h-8 text-sm" />
                    </FieldRow>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldRow label="Forme juridique">
                        <NativeSelect value={tenantForm.companyLegalForm} onChange={(e) => setTenantForm((f) => ({ ...f, companyLegalForm: e.target.value }))} options={LEGAL_FORM_OPTIONS} />
                      </FieldRow>
                      <FieldRow label="SIRET">
                        <Input value={tenantForm.siret} onChange={(e) => setTenantForm((f) => ({ ...f, siret: e.target.value }))} placeholder="12345678901234" className="h-8 text-sm" />
                      </FieldRow>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldRow label="Représentant légal">
                        <Input value={tenantForm.legalRepName} onChange={(e) => setTenantForm((f) => ({ ...f, legalRepName: e.target.value }))} className="h-8 text-sm" />
                      </FieldRow>
                      <FieldRow label="Qualité">
                        <Input value={tenantForm.legalRepTitle} onChange={(e) => setTenantForm((f) => ({ ...f, legalRepTitle: e.target.value }))} placeholder="Gérant" className="h-8 text-sm" />
                      </FieldRow>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Prénom *">
                      <Input value={tenantForm.firstName} onChange={(e) => setTenantForm((f) => ({ ...f, firstName: e.target.value }))} className="h-8 text-sm" />
                    </FieldRow>
                    <FieldRow label="Nom *">
                      <Input value={tenantForm.lastName} onChange={(e) => setTenantForm((f) => ({ ...f, lastName: e.target.value }))} className="h-8 text-sm" />
                    </FieldRow>
                  </div>
                )}

                <Separator />
                <FieldRow label="Email *">
                  <Input type="email" value={tenantForm.email} onChange={(e) => setTenantForm((f) => ({ ...f, email: e.target.value }))} placeholder="contact@societe.fr" className="h-8 text-sm" />
                </FieldRow>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Téléphone">
                    <Input value={tenantForm.phone} onChange={(e) => setTenantForm((f) => ({ ...f, phone: e.target.value }))} className="h-8 text-sm" />
                  </FieldRow>
                  <FieldRow label="Mobile">
                    <Input value={tenantForm.mobile} onChange={(e) => setTenantForm((f) => ({ ...f, mobile: e.target.value }))} className="h-8 text-sm" />
                  </FieldRow>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ────────────── Étape 3 : Conditions ──────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Type et durée</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type de bail *</Label>
                  <select value={leaseType} onChange={(e) => handleLeaseTypeChange(e.target.value as LeaseType)} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {LEASE_TYPE_OPTIONS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <NativeSelect options={DESTINATION_OPTIONS} value={destination} onChange={(e) => setDestination(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Durée (mois) *</Label>
                  <Input type="number" min={1} value={durationMonths} onChange={(e) => setDurationMonths(parseInt(e.target.value) || 1)} required />
                </div>
                <div className="space-y-2">
                  <Label>Date de début *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Fréquence</Label>
                  <NativeSelect options={PAYMENT_FREQUENCIES} value={frequency} onChange={(e) => setFrequency(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Terme</Label>
                  <NativeSelect options={BILLING_TERMS} defaultValue="A_ECHOIR" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Loyer et dépôt</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Loyer HT (€/{FREQ_PERIOD_LABELS[frequency] ?? "mois"}) *</Label>
                  <Input type="number" min={0} step={0.01} value={baseRentHT} onChange={(e) => setBaseRentHT(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Dépôt de garantie (€)</Label>
                  <Input type="number" min={0} step={0.01} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="vat" checked={vatApplicable} className="h-4 w-4" onChange={(e) => setVatApplicable(e.target.checked)} />
                <Label htmlFor="vat">TVA applicable</Label>
                {vatApplicable && (
                  <div className="flex items-center gap-2 ml-4">
                    <Input type="number" min={0} max={100} step={0.1} value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-20" />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Franchise (mois)</Label>
                  <Input type="number" min={0} step={0.5} value={rentFreeMonths} onChange={(e) => setRentFreeMonths(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Pas-de-porte (€)</Label>
                  <Input type="number" min={0} step={0.01} value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Indexation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Indice</Label>
                  <NativeSelect options={INDEX_TYPES_LIST} value={indexType} onChange={(e) => setIndexType(e.target.value)} placeholder="Sans indexation" />
                </div>
                <div className="space-y-2">
                  <Label>Valeur</Label>
                  <Input type="number" step={0.01} placeholder="132.45" value={baseIndexValue} onChange={(e) => setBaseIndexValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Trimestre</Label>
                  <Input placeholder="T1 2024" value={baseIndexQuarter} onChange={(e) => setBaseIndexQuarter(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fréquence révision (mois)</Label>
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
                        { value: "1", label: "Janvier" }, { value: "2", label: "Février" }, { value: "3", label: "Mars" },
                        { value: "4", label: "Avril" }, { value: "5", label: "Mai" }, { value: "6", label: "Juin" },
                        { value: "7", label: "Juillet" }, { value: "8", label: "Août" }, { value: "9", label: "Septembre" },
                        { value: "10", label: "Octobre" }, { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" },
                      ]}
                      value={revisionCustomMonth}
                      onChange={(e) => setRevisionCustomMonth(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Clauses et gestion tiers</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Travaux et aménagements autorisés</Label>
                <Textarea rows={3} placeholder="Travaux autorisés, conditions de restitution..." value={tenantWorksClauses} onChange={(e) => setTenantWorksClauses(e.target.value)} />
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <input type="checkbox" id="thirdParty" checked={isThirdPartyManaged} className="h-4 w-4" onChange={(e) => setIsThirdPartyManaged(e.target.checked)} />
                <Label htmlFor="thirdParty">Bail sous gestion tiers</Label>
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
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{managementFeeType === "POURCENTAGE" ? "Taux (%)" : "Montant (€)"}</Label>
                      <Input type="number" min={0} value={managementFeeValue} onChange={(e) => setManagementFeeValue(parseFloat(e.target.value) || 0)} />
                    </div>
                    {managementFeeType === "POURCENTAGE" && (
                      <div className="space-y-2">
                        <Label>Base de calcul</Label>
                        <NativeSelect options={FEE_BASIS_OPTIONS} value={managementFeeBasis} onChange={(e) => setManagementFeeBasis(e.target.value as "LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC")} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ────────────── Étape 4 : Récapitulatif ──────────────── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif</CardTitle>
            <CardDescription>Vérifiez les informations avant de créer le bail</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Immeuble */}
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 mt-0.5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Immeuble</p>
                <p className="text-sm text-muted-foreground">
                  {useExistingBuilding
                    ? buildings.find((b) => b.id === existingBuildingId)
                      ? `${buildings.find((b) => b.id === existingBuildingId)!.name} — ${buildings.find((b) => b.id === existingBuildingId)!.city}`
                      : "—"
                    : `${buildingForm.name}, ${buildingForm.addressLine1}, ${buildingForm.postalCode} ${buildingForm.city}`}
                </p>
              </div>
            </div>
            <Separator />

            {/* Lot */}
            <div className="flex items-start gap-3">
              <Layers className="h-4 w-4 mt-0.5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">Lot{secondaryLotIds.length > 0 ? "s" : ""}</p>
                <p className="text-sm text-muted-foreground">
                  {useExistingLot
                    ? `Lot ${lots.find((l) => l.id === existingLotId)?.number ?? "—"}`
                    : `Lot ${lotForm.number} — ${lotForm.lotType} (${lotForm.area} m²)`}
                  {secondaryLotIds.length > 0 && ` + ${secondaryLotIds.length} lots secondaires`}
                </p>
              </div>
            </div>
            <Separator />

            {/* Locataire */}
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 mt-0.5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Locataire</p>
                <p className="text-sm text-muted-foreground">
                  {useExistingTenant
                    ? tenants.find((t) => t.id === existingTenantId)
                      ? tenantLabel(tenants.find((t) => t.id === existingTenantId)!)
                      : "—"
                    : tenantForm.entityType === "PERSONNE_MORALE"
                      ? tenantForm.companyName
                      : `${tenantForm.firstName} ${tenantForm.lastName}`}
                </p>
              </div>
            </div>
            <Separator />

            {/* Conditions */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type de bail</p>
                <p className="font-medium">{LEASE_TYPE_OPTIONS.flatMap((g) => g.items).find((i) => i.value === leaseType)?.label ?? leaseType}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date de début</p>
                <p className="font-medium">{startDate || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Durée</p>
                <p className="font-medium">{durationMonths} mois</p>
              </div>
              <div>
                <p className="text-muted-foreground">Loyer HT</p>
                <p className="font-medium">{baseRentHT ? `${baseRentHT} €/${FREQ_PERIOD_LABELS[frequency] ?? "mois"}` : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dépôt de garantie</p>
                <p className="font-medium">{depositAmount ? `${depositAmount} €` : "Aucun"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Indexation</p>
                <p className="font-medium">{indexType || "Sans"}</p>
              </div>
              {isThirdPartyManaged && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Gestion tiers</p>
                  <p className="font-medium">
                    {managementFeeType === "POURCENTAGE"
                      ? `${managementFeeValue}% du ${FEE_BASIS_OPTIONS.find((o) => o.value === managementFeeBasis)?.label ?? "loyer"}`
                      : `${managementFeeValue} € / mois`}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ────────────── Navigation ──────────────── */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={step === 1 ? () => router.push("/baux/nouveau") : goBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {step === 1 ? "Annuler" : "Précédent"}
        </Button>
        {step < 4 ? (
          <Button onClick={goNext}>
            Suivant
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Création...</>
            ) : (
              "Créer le bail"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
