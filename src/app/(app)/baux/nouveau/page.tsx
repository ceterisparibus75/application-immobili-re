"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createLease } from "@/actions/lease";
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
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Layers,
  Loader2,
  PenLine,
  Users,
} from "lucide-react";
import { useSociety } from "@/providers/society-provider";
import { cn } from "@/lib/utils";
import {
  getDefaultDuration,
  getDefaultIndexType,
  getDefaultVat,
  type LeaseType,
  type CreateLeaseInput,
} from "@/validations/lease";
import { toast } from "sonner";

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
  { value: "SAS", label: "SAS" },
  { value: "SARL", label: "SARL" },
  { value: "SA", label: "SA" },
  { value: "SCI", label: "SCI" },
  { value: "EURL", label: "EURL" },
  { value: "SASU", label: "SASU" },
  { value: "SNC", label: "SNC" },
  { value: "EI", label: "Entreprise individuelle" },
  { value: "AUTRE", label: "Autre" },
];

type LotOption = {
  id: string;
  number: string;
  lotType: string;
  area: number;
  status: string;
  building: { id: string; name: string; city: string };
};

type BuildingOption = {
  id: string;
  name: string;
  city: string;
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

type LeaseCreationMode = "existing" | "workflow";

type BuildingForm = {
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  buildingType: string;
};

type LotForm = {
  number: string;
  lotType: string;
  area: string;
  floor: string;
  position: string;
};

type TenantForm = {
  entityType: "PERSONNE_MORALE" | "PERSONNE_PHYSIQUE";
  companyName: string;
  companyLegalForm: string;
  siret: string;
  legalRepName: string;
  legalRepTitle: string;
  legalRepEmail: string;
  legalRepPhone: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
};

type LeaseImportAnalysis = {
  immeuble?: {
    name?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    postalCode?: string | null;
    buildingType?: string | null;
  };
  lot?: {
    number?: string | null;
    lotType?: string | null;
    area?: number | null;
    floor?: string | null;
    position?: string | null;
  };
  locataire?: {
    entityType?: "PERSONNE_MORALE" | "PERSONNE_PHYSIQUE" | null;
    email?: string | null;
    companyName?: string | null;
    companyLegalForm?: string | null;
    siret?: string | null;
    legalRepName?: string | null;
    legalRepTitle?: string | null;
    legalRepEmail?: string | null;
    legalRepPhone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    mobile?: string | null;
  };
  bail?: {
    leaseType?: LeaseType | null;
    destination?: CreateLeaseInput["destination"] | null;
    startDate?: string | null;
    durationMonths?: number | null;
    baseRentHT?: number | null;
    depositAmount?: number | null;
    paymentFrequency?: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL" | null;
    vatApplicable?: boolean | null;
    vatRate?: number | null;
    indexType?: "IRL" | "ILC" | "ILAT" | "ICC" | null;
    baseIndexValue?: number | null;
    baseIndexQuarter?: string | null;
    revisionFrequency?: number | null;
    revisionDateBasis?:
      | "DATE_SIGNATURE"
      | "DATE_ENTREE"
      | "PREMIER_JANVIER"
      | "DATE_PERSONNALISEE"
      | null;
    revisionCustomMonth?: number | null;
    revisionCustomDay?: number | null;
    rentFreeMonths?: number | null;
    entryFee?: number | null;
    tenantWorksClauses?: string | null;
  };
};

const FEE_BASIS_OPTIONS = [
  { value: "LOYER_HT", label: "Loyer HT seul" },
  { value: "LOYER_CHARGES_HT", label: "Loyer + charges HT" },
  { value: "TOTAL_TTC", label: "Total TTC" },
];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function tenantLabel(tenant: TenantOption) {
  return tenant.entityType === "PERSONNE_MORALE"
    ? (tenant.companyName ?? tenant.email)
    : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || tenant.email;
}

function emptyBuildingForm(): BuildingForm {
  return {
    name: "",
    addressLine1: "",
    city: "",
    postalCode: "",
    buildingType: "COMMERCE",
  };
}

function emptyLotForm(): LotForm {
  return {
    number: "",
    lotType: "LOCAL_COMMERCIAL",
    area: "",
    floor: "",
    position: "",
  };
}

function emptyTenantForm(): TenantForm {
  return {
    entityType: "PERSONNE_MORALE",
    companyName: "",
    companyLegalForm: "",
    siret: "",
    legalRepName: "",
    legalRepTitle: "",
    legalRepEmail: "",
    legalRepPhone: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
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

function SectionImmeuble({
  form,
  onChange,
  buildings,
  useExisting,
  existingId,
  onToggleExisting,
  onExistingChange,
}: {
  form: BuildingForm;
  onChange: (updates: Partial<BuildingForm>) => void;
  buildings: BuildingOption[];
  useExisting: boolean;
  existingId: string;
  onToggleExisting: () => void;
  onExistingChange: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-blue-500" />
          Immeuble
        </CardTitle>
        {buildings.length > 0 && (
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useExisting}
              onChange={onToggleExisting}
              className="h-4 w-4"
            />
            Utiliser un immeuble existant
          </label>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {useExisting ? (
          <FieldRow label="Immeuble *">
            <NativeSelect
              value={existingId}
              onChange={(e) => onExistingChange(e.target.value)}
              options={buildings.map((building) => ({
                value: building.id,
                label: `${building.name} — ${building.city}`,
              }))}
              placeholder="— Sélectionner —"
            />
          </FieldRow>
        ) : (
          <>
            <FieldRow label="Nom *">
              <Input
                value={form.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Ex : Immeuble du Centre"
                className="h-8 text-sm"
              />
            </FieldRow>
            <FieldRow label="Adresse *">
              <Input
                value={form.addressLine1}
                onChange={(e) => onChange({ addressLine1: e.target.value })}
                placeholder="12 rue de la Paix"
                className="h-8 text-sm"
              />
            </FieldRow>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Ville *">
                <Input
                  value={form.city}
                  onChange={(e) => onChange({ city: e.target.value })}
                  placeholder="Paris"
                  className="h-8 text-sm"
                />
              </FieldRow>
              <FieldRow label="Code postal *">
                <Input
                  value={form.postalCode}
                  onChange={(e) => onChange({ postalCode: e.target.value })}
                  placeholder="75001"
                  className="h-8 text-sm"
                />
              </FieldRow>
            </div>
            <FieldRow label="Type *">
              <NativeSelect
                value={form.buildingType}
                onChange={(e) => onChange({ buildingType: e.target.value })}
                options={BUILDING_TYPE_OPTIONS}
              />
            </FieldRow>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SectionLot({
  form,
  onChange,
  lots,
  useExisting,
  existingId,
  onToggleExisting,
  onExistingChange,
}: {
  form: LotForm;
  onChange: (updates: Partial<LotForm>) => void;
  lots: LotOption[];
  useExisting: boolean;
  existingId: string;
  onToggleExisting: () => void;
  onExistingChange: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-[var(--color-status-positive)]" />
          Lot
        </CardTitle>
        {lots.length > 0 && (
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useExisting}
              onChange={onToggleExisting}
              className="h-4 w-4"
            />
            Utiliser un lot existant
          </label>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {useExisting ? (
          <FieldRow label="Lot *">
            <NativeSelect
              value={existingId}
              onChange={(e) => onExistingChange(e.target.value)}
              options={lots.map((lot) => ({
                value: lot.id,
                label: `Lot ${lot.number} — ${lot.lotType} (${lot.area} m²)`,
              }))}
              placeholder="— Sélectionner un lot —"
            />
          </FieldRow>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Numéro *">
                <Input
                  value={form.number}
                  onChange={(e) => onChange({ number: e.target.value })}
                  placeholder="A1"
                  className="h-8 text-sm"
                />
              </FieldRow>
              <FieldRow label="Surface (m²) *">
                <Input
                  type="number"
                  value={form.area}
                  onChange={(e) => onChange({ area: e.target.value })}
                  placeholder="120"
                  className="h-8 text-sm"
                />
              </FieldRow>
            </div>
            <FieldRow label="Type *">
              <NativeSelect
                value={form.lotType}
                onChange={(e) => onChange({ lotType: e.target.value })}
                options={LOT_TYPE_OPTIONS}
              />
            </FieldRow>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Étage">
                <Input
                  value={form.floor}
                  onChange={(e) => onChange({ floor: e.target.value })}
                  placeholder="RDC"
                  className="h-8 text-sm"
                />
              </FieldRow>
              <FieldRow label="Position">
                <Input
                  value={form.position}
                  onChange={(e) => onChange({ position: e.target.value })}
                  placeholder="Aile droite"
                  className="h-8 text-sm"
                />
              </FieldRow>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SectionLocataire({
  form,
  onChange,
  tenants,
  useExisting,
  existingId,
  onToggleExisting,
  onExistingChange,
}: {
  form: TenantForm;
  onChange: (updates: Partial<TenantForm>) => void;
  tenants: TenantOption[];
  useExisting: boolean;
  existingId: string;
  onToggleExisting: () => void;
  onExistingChange: (id: string) => void;
}) {
  const isCompany = form.entityType === "PERSONNE_MORALE";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-purple-500" />
          Locataire
        </CardTitle>
        {tenants.length > 0 && (
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useExisting}
              onChange={onToggleExisting}
              className="h-4 w-4"
            />
            Utiliser un locataire existant
          </label>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {useExisting ? (
          <FieldRow label="Locataire *">
            <NativeSelect
              value={existingId}
              onChange={(e) => onExistingChange(e.target.value)}
              options={tenants.map((tenant) => ({
                value: tenant.id,
                label: `${tenantLabel(tenant)} — ${tenant.email}`,
              }))}
              placeholder="— Sélectionner —"
            />
          </FieldRow>
        ) : (
          <>
            <div className="flex gap-2">
              {(["PERSONNE_MORALE", "PERSONNE_PHYSIQUE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onChange({ entityType: type })}
                  className={cn(
                    "flex-1 rounded-md border py-1.5 text-xs transition-colors",
                    form.entityType === type
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  {type === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}
                </button>
              ))}
            </div>

            {isCompany ? (
              <>
                <FieldRow label="Raison sociale *">
                  <Input
                    value={form.companyName}
                    onChange={(e) => onChange({ companyName: e.target.value })}
                    placeholder="Société ACME"
                    className="h-8 text-sm"
                  />
                </FieldRow>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Forme juridique">
                    <NativeSelect
                      value={form.companyLegalForm}
                      onChange={(e) => onChange({ companyLegalForm: e.target.value })}
                      options={LEGAL_FORM_OPTIONS}
                    />
                  </FieldRow>
                  <FieldRow label="SIRET">
                    <Input
                      value={form.siret}
                      onChange={(e) => onChange({ siret: e.target.value })}
                      placeholder="12345678901234"
                      className="h-8 text-sm"
                    />
                  </FieldRow>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Représentant légal">
                    <Input
                      value={form.legalRepName}
                      onChange={(e) => onChange({ legalRepName: e.target.value })}
                      placeholder="Jean Dupont"
                      className="h-8 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Qualité">
                    <Input
                      value={form.legalRepTitle}
                      onChange={(e) => onChange({ legalRepTitle: e.target.value })}
                      placeholder="Gérant"
                      className="h-8 text-sm"
                    />
                  </FieldRow>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Email représentant">
                    <Input
                      type="email"
                      value={form.legalRepEmail}
                      onChange={(e) => onChange({ legalRepEmail: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </FieldRow>
                  <FieldRow label="Tél. représentant">
                    <Input
                      value={form.legalRepPhone}
                      onChange={(e) => onChange({ legalRepPhone: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </FieldRow>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <FieldRow label="Prénom *">
                  <Input
                    value={form.firstName}
                    onChange={(e) => onChange({ firstName: e.target.value })}
                    className="h-8 text-sm"
                  />
                </FieldRow>
                <FieldRow label="Nom *">
                  <Input
                    value={form.lastName}
                    onChange={(e) => onChange({ lastName: e.target.value })}
                    className="h-8 text-sm"
                  />
                </FieldRow>
              </div>
            )}

            <Separator />
            <FieldRow label="Email *">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => onChange({ email: e.target.value })}
                placeholder="contact@societe.fr"
                className="h-8 text-sm"
              />
            </FieldRow>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Téléphone">
                <Input
                  value={form.phone}
                  onChange={(e) => onChange({ phone: e.target.value })}
                  className="h-8 text-sm"
                />
              </FieldRow>
              <FieldRow label="Mobile">
                <Input
                  value={form.mobile}
                  onChange={(e) => onChange({ mobile: e.target.value })}
                  className="h-8 text-sm"
                />
              </FieldRow>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function NouveauBailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useSociety();
  const creationMode: LeaseCreationMode =
    searchParams.get("mode") === "workflow" ? "workflow" : "existing";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lots, setLots] = useState<LotOption[]>([]);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [leaseType, setLeaseType] = useState<LeaseType>("HABITATION");
  const [tenantId, setTenantId] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [vatApplicable, setVatApplicable] = useState(false);
  const [frequency, setFrequency] = useState("MENSUEL");
  const [durationMonths, setDurationMonths] = useState(36);
  const [baseRentHT, setBaseRentHT] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [indexType, setIndexType] = useState<string>("IRL");
  const [baseIndexValue, setBaseIndexValue] = useState("");
  const [baseIndexQuarter, setBaseIndexQuarter] = useState("");
  const [revisionFrequency, setRevisionFrequency] = useState("12");
  const [revisionDateBasis, setRevisionDateBasis] = useState<string>("DATE_SIGNATURE");
  const [revisionCustomMonth, setRevisionCustomMonth] = useState("1");
  const [revisionCustomDay, setRevisionCustomDay] = useState("1");
  const [rentFreeMonths, setRentFreeMonths] = useState("0");
  const [entryFee, setEntryFee] = useState("0");
  const [tenantWorksClauses, setTenantWorksClauses] = useState("");
  const [isThirdPartyManaged, setIsThirdPartyManaged] = useState(false);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [managingContactId, setManagingContactId] = useState<string>("");
  const [managementFeeType, setManagementFeeType] = useState<"POURCENTAGE" | "FORFAIT">("POURCENTAGE");
  const [managementFeeValue, setManagementFeeValue] = useState<number>(0);
  const [managementFeeBasis, setManagementFeeBasis] = useState<"LOYER_HT" | "LOYER_CHARGES_HT" | "TOTAL_TTC">("LOYER_HT");
  const [managementFeeVatRate, setManagementFeeVatRate] = useState<number>(20);
  const [signedLeaseFile, setSignedLeaseFile] = useState<File | null>(null);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [analysisHint, setAnalysisHint] = useState("");
  const [analysisNeedsImportFlow, setAnalysisNeedsImportFlow] = useState(false);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [useExistingBuilding, setUseExistingBuilding] = useState(false);
  const [existingBuildingId, setExistingBuildingId] = useState("");
  const [buildingForm, setBuildingForm] = useState<BuildingForm>(emptyBuildingForm());
  const [useExistingLot, setUseExistingLot] = useState(false);
  const [existingLotId, setExistingLotId] = useState("");
  const [secondaryLotIds, setSecondaryLotIds] = useState<string[]>([]);
  const [lotForm, setLotForm] = useState<LotForm>(emptyLotForm());
  const [useExistingTenant, setUseExistingTenant] = useState(false);
  const [existingTenantId, setExistingTenantId] = useState("");
  const [tenantForm, setTenantForm] = useState<TenantForm>(emptyTenantForm());

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
  const existingLotsForImport = useExistingBuilding && existingBuildingId
    ? lots.filter((lot) => lot.status === "VACANT" && lot.building.id === existingBuildingId)
    : lots.filter((lot) => lot.status === "VACANT");
  const availableSecondaryLots = existingLotsForImport.filter((lot) => lot.id !== existingLotId);

  const pageCopy =
    creationMode === "workflow"
      ? {
          title: "Créer un bail à préparer et signer",
          subtitle:
            "Utilisez cette entrée quand le bail n'est pas encore signé et que vous voulez enchaîner préparation, dépôt du PDF puis signature.",
          badge: "Workflow signature",
          submitLabel: "Créer le bail et ouvrir la signature",
          nextStepTitle: "Suite prévue",
          nextStepDescription:
            "Après création, vous serez redirigé vers la fiche bail pour déposer le document final et lancer la signature.",
        }
      : {
          title: "Ajouter un bail déjà signé",
          subtitle:
            "Utilisez cette entrée quand le bail existe déjà et que vous voulez l'intégrer dans la gestion sans lancer de workflow de signature.",
          badge: "Bail existant",
          submitLabel: "Ajouter le bail",
          nextStepTitle: "Suite prévue",
          nextStepDescription:
            "Le PDF signé lance l'analyse IA, puis vous pouvez créer ou rattacher l'immeuble, le lot et le locataire avant validation.",
        };

  // Pré-sélectionner le lot si passé en paramètre
  useEffect(() => {
    if (defaultLotId && selectedLotIds.length === 0) {
      setSelectedLotIds([defaultLotId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLotId]);

  useEffect(() => {
    if (defaultTenantId && !tenantId) {
      setTenantId(defaultTenantId);
    }
  }, [defaultTenantId, tenantId]);

  useEffect(() => {
    if (!useExistingLot || !existingLotId) return;
    const selectedLot = lots.find((lot) => lot.id === existingLotId);
    if (!selectedLot) return;
    if (existingBuildingId !== selectedLot.building.id) {
      setExistingBuildingId(selectedLot.building.id);
    }
    if (!useExistingBuilding) {
      setUseExistingBuilding(true);
    }
  }, [existingBuildingId, existingLotId, lots, useExistingBuilding, useExistingLot]);

  useEffect(() => {
    if (!useExistingLot || !existingLotId || !existingBuildingId) return;
    const selectedLot = lots.find((lot) => lot.id === existingLotId);
    if (selectedLot && selectedLot.building.id !== existingBuildingId) {
      setExistingLotId("");
    }
  }, [existingBuildingId, existingLotId, lots, useExistingLot]);

  useEffect(() => {
    if (!existingLotId) return;
    setSecondaryLotIds((current) => current.filter((lotId) => lotId !== existingLotId));
  }, [existingLotId]);

  useEffect(() => {
    const allowedIds = new Set(availableSecondaryLots.map((lot) => lot.id));
    setSecondaryLotIds((current) => current.filter((lotId) => allowedIds.has(lotId)));
  }, [availableSecondaryLots]);

  useEffect(() => {
    if (!activeSociety) return;
    const societyId = activeSociety.id;
    async function fetchOptions() {
      const [buildingList, tenantList, lotList] = await Promise.all([
        getBuildings(societyId),
        getActiveTenants(societyId),
        getLots(societyId),
      ]);

      setBuildings(
        buildingList.map((building) => ({
          id: building.id,
          name: building.name,
          city: building.city,
        }))
      );
      setTenants(tenantList);
      setLots(
        lotList.map((lot) => ({
          id: lot.id,
          number: lot.number,
          lotType: lot.lotType,
          area: lot.area,
          status: lot.status,
          building: {
            id: lot.building.id,
            name: lot.building.name,
            city: lot.building.city,
          },
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
        } else {
          setAgencies([]);
        }
      } catch {
        setAgencies([]);
      }
    }
    void fetchAgencies();
  }, [isThirdPartyManaged]);

  function lotLabel(l: LotOption) {
    return `${l.building.name} — Lot ${l.number} (${l.area} m²) — ${l.building.city}`;
  }

  function updateBuildingForm(updates: Partial<BuildingForm>) {
    setBuildingForm((current) => ({ ...current, ...updates }));
  }

  function updateLotForm(updates: Partial<LotForm>) {
    setLotForm((current) => ({ ...current, ...updates }));
  }

  function updateTenantForm(updates: Partial<TenantForm>) {
    setTenantForm((current) => ({ ...current, ...updates }));
  }

  function blobToBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Conversion du PDF impossible"));
          return;
        }
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error ?? new Error("Lecture du PDF impossible"));
      reader.readAsDataURL(blob);
    });
  }

  async function uploadPdfForAnalysis(file: File) {
    const chunkSize = 2.5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = crypto.randomUUID();
    let storagePath = "";

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const data = await blobToBase64(chunk);
      const uploadResponse = await fetch("/api/import/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          chunkIndex,
          totalChunks,
          data,
          uploadId,
        }),
      });

      const payload = (await uploadResponse.json().catch(() => ({}))) as {
        storagePath?: string;
        error?: string;
      };

      if (!uploadResponse.ok) {
        throw new Error(payload.error ?? "Import temporaire du PDF impossible");
      }

      if (payload.storagePath) {
        storagePath = payload.storagePath;
      }
    }

    if (!storagePath) {
      throw new Error("Aucun chemin temporaire retourné pour l'analyse du bail");
    }

    return storagePath;
  }

  function applyLeaseAnalysis(analysis: LeaseImportAnalysis) {
    const hints: string[] = [];
    const hasStructureToResolve = Boolean(
      analysis.immeuble?.name ||
      analysis.immeuble?.addressLine1 ||
      analysis.lot?.number ||
      analysis.locataire?.email ||
      analysis.locataire?.companyName ||
      analysis.locataire?.firstName ||
      analysis.locataire?.lastName
    );

    if (analysis.bail?.leaseType) {
      setLeaseType(analysis.bail.leaseType);
      hints.push(`type ${analysis.bail.leaseType}`);
    }
    setSelectedTemplateId("");

    if (analysis.bail?.destination) {
      setDestination(analysis.bail.destination);
    }
    if (analysis.bail?.startDate) {
      setStartDate(analysis.bail.startDate);
      hints.push(`début ${analysis.bail.startDate}`);
    }
    if (analysis.bail?.durationMonths) {
      setDurationMonths(analysis.bail.durationMonths);
    }
    if (analysis.bail?.baseRentHT !== null && analysis.bail?.baseRentHT !== undefined) {
      setBaseRentHT(String(analysis.bail.baseRentHT));
      hints.push(`loyer ${analysis.bail.baseRentHT} €`);
    }
    if (analysis.bail?.depositAmount !== null && analysis.bail?.depositAmount !== undefined) {
      setDepositAmount(String(analysis.bail.depositAmount));
    }
    if (analysis.bail?.paymentFrequency) {
      setFrequency(analysis.bail.paymentFrequency);
    }
    if (analysis.bail?.vatApplicable !== null && analysis.bail?.vatApplicable !== undefined) {
      setVatApplicable(analysis.bail.vatApplicable);
    }
    if (analysis.bail?.vatRate !== null && analysis.bail?.vatRate !== undefined) {
      setVatRate(String(analysis.bail.vatRate));
    }
    if (analysis.bail?.indexType !== null && analysis.bail?.indexType !== undefined) {
      setIndexType(analysis.bail.indexType);
    }
    if (analysis.bail?.baseIndexValue !== null && analysis.bail?.baseIndexValue !== undefined) {
      setBaseIndexValue(String(analysis.bail.baseIndexValue));
    }
    if (analysis.bail?.baseIndexQuarter) {
      setBaseIndexQuarter(analysis.bail.baseIndexQuarter);
    }
    if (analysis.bail?.revisionFrequency) {
      setRevisionFrequency(String(analysis.bail.revisionFrequency));
    }
    if (analysis.bail?.revisionDateBasis) {
      setRevisionDateBasis(analysis.bail.revisionDateBasis);
    }
    if (analysis.bail?.revisionCustomMonth) {
      setRevisionCustomMonth(String(analysis.bail.revisionCustomMonth));
    }
    if (analysis.bail?.revisionCustomDay) {
      setRevisionCustomDay(String(analysis.bail.revisionCustomDay));
    }
    if (analysis.bail?.rentFreeMonths !== null && analysis.bail?.rentFreeMonths !== undefined) {
      setRentFreeMonths(String(analysis.bail.rentFreeMonths));
    }
    if (analysis.bail?.entryFee !== null && analysis.bail?.entryFee !== undefined) {
      setEntryFee(String(analysis.bail.entryFee));
    }
    if (analysis.bail?.tenantWorksClauses) {
      setTenantWorksClauses(analysis.bail.tenantWorksClauses);
    }

    setBuildingForm({
      name: analysis.immeuble?.name ?? "",
      addressLine1: analysis.immeuble?.addressLine1 ?? "",
      city: analysis.immeuble?.city ?? "",
      postalCode: analysis.immeuble?.postalCode ?? "",
      buildingType: analysis.immeuble?.buildingType ?? "COMMERCE",
    });

    setLotForm({
      number: analysis.lot?.number ?? "",
      lotType: analysis.lot?.lotType ?? "LOCAL_COMMERCIAL",
      area:
        analysis.lot?.area !== null && analysis.lot?.area !== undefined
          ? String(analysis.lot.area)
          : "",
      floor: analysis.lot?.floor ?? "",
      position: analysis.lot?.position ?? "",
    });

    setTenantForm({
      entityType: analysis.locataire?.entityType === "PERSONNE_PHYSIQUE" ? "PERSONNE_PHYSIQUE" : "PERSONNE_MORALE",
      companyName: analysis.locataire?.companyName ?? "",
      companyLegalForm: analysis.locataire?.companyLegalForm ?? "",
      siret: analysis.locataire?.siret ?? "",
      legalRepName: analysis.locataire?.legalRepName ?? "",
      legalRepTitle: analysis.locataire?.legalRepTitle ?? "",
      legalRepEmail: analysis.locataire?.legalRepEmail ?? "",
      legalRepPhone: analysis.locataire?.legalRepPhone ?? "",
      firstName: analysis.locataire?.firstName ?? "",
      lastName: analysis.locataire?.lastName ?? "",
      email: analysis.locataire?.email ?? "",
      phone: analysis.locataire?.phone ?? "",
      mobile: analysis.locataire?.mobile ?? "",
    });

    const analyzedEmail = normalize(analysis.locataire?.email);
    const analyzedCompany = normalize(analysis.locataire?.companyName);
    const analyzedPerson = normalize(
      [analysis.locataire?.firstName, analysis.locataire?.lastName].filter(Boolean).join(" ")
    );

    const matchedTenant = tenants.find((candidate) => {
      const email = normalize(candidate.email);
      const company = normalize(candidate.companyName);
      const person = normalize(
        [candidate.firstName, candidate.lastName].filter(Boolean).join(" ")
      );

      if (analyzedEmail && analyzedEmail !== "a-renseigner@exemple.fr" && email === analyzedEmail) {
        return true;
      }
      if (analyzedCompany && company === analyzedCompany) {
        return true;
      }
      return analyzedPerson ? person === analyzedPerson : false;
    });

    if (matchedTenant) {
      setTenantId(matchedTenant.id);
      setExistingTenantId(matchedTenant.id);
      setUseExistingTenant(true);
      hints.push(`locataire ${tenantLabel(matchedTenant)}`);
    } else {
      setExistingTenantId("");
      setUseExistingTenant(false);
      if (analyzedEmail || analyzedCompany || analyzedPerson) {
        hints.push("locataire à créer ou rattacher");
      }
    }

    const analyzedLotNumber = normalize(analysis.lot?.number);
    const analyzedBuildingName = normalize(analysis.immeuble?.name);
    const matchingBuildings = buildings.filter((building) => {
      const sameName = analyzedBuildingName && normalize(building.name).includes(analyzedBuildingName);
      const sameCity =
        analysis.immeuble?.city &&
        normalize(building.city) === normalize(analysis.immeuble.city);
      return Boolean(sameName || sameCity);
    });
    const matchedBuilding = matchingBuildings.length === 1 ? matchingBuildings[0] : null;

    if (matchedBuilding) {
      setExistingBuildingId(matchedBuilding.id);
      setUseExistingBuilding(true);
      hints.push(`immeuble ${matchedBuilding.name}`);
    } else {
      setExistingBuildingId("");
      setUseExistingBuilding(false);
      if (analyzedBuildingName || analysis.immeuble?.addressLine1) {
        hints.push("immeuble à créer ou rattacher");
      }
    }

    const matchingLots = lots.filter((lot) => {
      if (!analyzedLotNumber || normalize(lot.number) !== analyzedLotNumber) {
        return false;
      }
      if (matchedBuilding) {
        return lot.building.id === matchedBuilding.id;
      }
      return !analyzedBuildingName || normalize(lot.building.name).includes(analyzedBuildingName);
    });
    const fallbackLot =
      matchingLots.length === 1
        ? matchingLots[0]
        : lots.find((lot) => analyzedLotNumber && normalize(lot.number) === analyzedLotNumber);

    if (fallbackLot) {
      setSelectedLotIds([fallbackLot.id]);
      setExistingLotId(fallbackLot.id);
      setUseExistingLot(true);
      setUseExistingBuilding(true);
      setExistingBuildingId(fallbackLot.building.id);
      hints.push(`lot ${fallbackLot.number}`);
    } else {
      setExistingLotId("");
      setUseExistingLot(false);
      if (analyzedLotNumber || analyzedBuildingName) {
        hints.push("lot à créer ou rattacher");
      }
    }

    setAnalysisNeedsImportFlow(hasStructureToResolve);
    setAnalysisHint(
      hints.length > 0
        ? `Analyse IA terminée : ${hints.join(", ")}.`
        : "Analyse IA terminée. Vérifiez les champs proposés avant de créer le bail."
    );
  }

  async function analyzeSignedLease(file: File) {
    setIsAnalyzingPdf(true);
    setAnalysisHint("");
    setAnalysisNeedsImportFlow(false);
    setError("");

    try {
      const storagePath = await uploadPdfForAnalysis(file);
      const analyzeResponse = await fetch("/api/import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });

      const payload = (await analyzeResponse.json().catch(() => ({}))) as
        | LeaseImportAnalysis
        | { error?: string };

      if (!analyzeResponse.ok) {
        throw new Error("error" in payload ? payload.error ?? "Analyse du bail impossible" : "Analyse du bail impossible");
      }

      applyLeaseAnalysis(payload as LeaseImportAnalysis);
      toast.success("Analyse IA terminée. Les champs ont été préremplis.");
    } catch (analysisError) {
      const message =
        analysisError instanceof Error
          ? analysisError.message
          : "L'analyse IA du bail a échoué";
      setError(message);
      setAnalysisHint("");
      setAnalysisNeedsImportFlow(false);
      toast.error(message);
    } finally {
      setIsAnalyzingPdf(false);
    }
  }

  function validateExistingImport(): string | null {
    if (!signedLeaseFile) return "Ajoutez le PDF signé du bail pour ce parcours";
    if (!useExistingBuilding) {
      if (!buildingForm.name) return "Nom de l'immeuble requis";
      if (!buildingForm.addressLine1) return "Adresse de l'immeuble requise";
      if (!buildingForm.city) return "Ville de l'immeuble requise";
      if (!buildingForm.postalCode) return "Code postal de l'immeuble requis";
    } else if (!existingBuildingId) {
      return "Sélectionnez un immeuble existant";
    }

    if (!useExistingLot) {
      if (!lotForm.number) return "Numéro de lot requis";
      if (!lotForm.area || Number.isNaN(parseFloat(lotForm.area))) {
        return "Surface du lot requise";
      }
    } else if (!existingLotId) {
      return "Sélectionnez un lot existant";
    }

    if (!useExistingTenant) {
      if (!tenantForm.email) return "Email du locataire requis";
      if (tenantForm.entityType === "PERSONNE_MORALE" && !tenantForm.companyName) {
        return "Raison sociale du locataire requise";
      }
      if (
        tenantForm.entityType === "PERSONNE_PHYSIQUE" &&
        (!tenantForm.firstName || !tenantForm.lastName)
      ) {
        return "Prénom et nom du locataire requis";
      }
    } else if (!existingTenantId) {
      return "Sélectionnez un locataire existant";
    }

    if (!startDate) return "Date de début du bail requise";
    if (!baseRentHT || Number.isNaN(parseFloat(baseRentHT))) return "Loyer HT requis";

    return null;
  }

  function buildExistingImportInput(): ImportInput {
    return {
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
        revisionFrequency: revisionFrequency ? parseInt(revisionFrequency, 10) : 12,
        revisionDateBasis: revisionDateBasis as ImportInput["lease"]["revisionDateBasis"],
        revisionCustomMonth: revisionCustomMonth ? parseInt(revisionCustomMonth, 10) : null,
        revisionCustomDay: revisionCustomDay ? parseInt(revisionCustomDay, 10) : null,
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
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) {
      setError("Aucune société sélectionnée");
      return;
    }

    setError("");
    setIsLoading(true);

    if (creationMode === "existing") {
      const importError = validateExistingImport();
      if (importError) {
        setError(importError);
        setIsLoading(false);
        return;
      }

      const result = await importFromPdf(activeSociety.id, buildExistingImportInput());

      if (!result.success || !result.data) {
        setError(result.error ?? "Erreur lors de l'import du bail signé");
        setIsLoading(false);
        return;
      }

      const pdfFormData = new FormData();
      pdfFormData.append("file", signedLeaseFile as File);
      pdfFormData.append("leaseId", result.data.leaseId);

      const uploadResponse = await fetch("/api/leases/upload-pdf", {
        method: "POST",
        body: pdfFormData,
      });

      if (!uploadResponse.ok) {
        const payload = await uploadResponse
          .json()
          .catch(() => ({ error: "Import du PDF impossible" }));

        toast.error("Le bail a été créé, mais le PDF signé n'a pas pu être archivé.");
        setIsLoading(false);
        setError(payload.error ?? "Import du PDF impossible");
        router.push(`/baux/${result.data.leaseId}#document-bail`);
        return;
      }

      toast.success("Bail signé importé avec son PDF et ses rattachements.");
      router.push(`/baux/${result.data.leaseId}`);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    if (selectedLotIds.length === 0) {
      setError("Sélectionnez au moins un lot");
      setIsLoading(false);
      return;
    }
    const result = await createLease(activeSociety.id, {
      lotIds: selectedLotIds,
      tenantId: data.tenantId,
      leaseType: data.leaseType as LeaseType,
      destination: (data.destination || null) as CreateLeaseInput["destination"],
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
      revisionDateBasis: (data.revisionDateBasis as "DATE_SIGNATURE" | "DATE_ENTREE" | "PREMIER_JANVIER" | "DATE_PERSONNALISEE") || "DATE_SIGNATURE",
      revisionCustomMonth: data.revisionCustomMonth ? parseInt(data.revisionCustomMonth) : null,
      revisionCustomDay: data.revisionCustomDay ? parseInt(data.revisionCustomDay) : null,
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

    if (result.success && result.data) {
      router.push(`/baux/${result.data.id}#signature-bail`);
    } else {
      setIsLoading(false);
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
          <h1 className="text-2xl font-bold tracking-tight">{pageCopy.title}</h1>
          <p className="text-muted-foreground">{pageCopy.subtitle}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <Badge variant={creationMode === "workflow" ? "default" : "secondary"}>
                {pageCopy.badge}
              </Badge>
              <div className="space-y-1">
                <p className="text-sm font-medium">{pageCopy.nextStepTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {pageCopy.nextStepDescription}
                </p>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                {creationMode === "workflow" ? (
                  <PenLine className="h-4 w-4 text-primary" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-status-positive)]" />
                )}
                {creationMode === "workflow"
                  ? "Parcours orienté préparation"
                  : "Parcours orienté exploitation"}
              </div>
              <p className="mt-1 text-muted-foreground">
                {creationMode === "workflow"
                  ? "Le bail est créé pour être complété puis envoyé en signature."
                  : "Le bail est créé comme contrat déjà finalisé, sans mise en avant du workflow de signature."}
              </p>
            </div>
          </CardContent>
        </Card>

        {creationMode === "existing" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>PDF du bail signé</CardTitle>
                <CardDescription>
                  Ce parcours sert à intégrer un bail déjà finalisé. Le PDF signé
                  déclenche l&apos;analyse IA puis sera archivé automatiquement à la création.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="signedLeasePdf">Bail signé au format PDF *</Label>
                  <Input
                    id="signedLeasePdf"
                    type="file"
                    accept="application/pdf"
                    required={creationMode === "existing"}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file && file.type !== "application/pdf") {
                        setSignedLeaseFile(null);
                        setAnalysisHint("");
                        setAnalysisNeedsImportFlow(false);
                        setError("Seuls les fichiers PDF sont acceptés pour le bail signé");
                        return;
                      }
                      setError("");
                      setSignedLeaseFile(file);
                      if (file) {
                        void analyzeSignedLease(file);
                      } else {
                        setAnalysisHint("");
                        setAnalysisNeedsImportFlow(false);
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    PDF, maximum 20 Mo. Il sera rattaché automatiquement au bail créé.
                  </p>
                  {isAnalyzingPdf && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyse IA en cours pour préremplir le bail...
                    </p>
                  )}
                  {analysisHint && !isAnalyzingPdf && (
                    <p className="text-sm text-[var(--color-status-positive)]">
                      {analysisHint}
                    </p>
                  )}
                  {analysisNeedsImportFlow && !isAnalyzingPdf && (
                    <p className="text-sm text-muted-foreground">
                      L&apos;analyse peut maintenant créer ou rattacher l&apos;immeuble, le lot et le locataire
                      directement dans ce formulaire.
                    </p>
                  )}
                  {signedLeaseFile && (
                    <p className="text-sm font-medium">{signedLeaseFile.name}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <SectionImmeuble
                  form={buildingForm}
                  onChange={updateBuildingForm}
                  buildings={buildings}
                  useExisting={useExistingBuilding}
                  existingId={existingBuildingId}
                  onToggleExisting={() => {
                    setUseExistingBuilding((current) => {
                      const next = !current;
                      if (!next) {
                        setExistingBuildingId("");
                        setUseExistingLot(false);
                        setExistingLotId("");
                      }
                      return next;
                    });
                  }}
                  onExistingChange={(id) => {
                    setExistingBuildingId(id);
                    setUseExistingBuilding(Boolean(id));
                  }}
                />
                <SectionLot
                  form={lotForm}
                  onChange={updateLotForm}
                  lots={existingLotsForImport}
                  useExisting={useExistingLot}
                  existingId={existingLotId}
                  onToggleExisting={() => {
                    setUseExistingLot((current) => !current);
                    setExistingLotId("");
                  }}
                  onExistingChange={(id) => {
                    setExistingLotId(id);
                    setUseExistingLot(Boolean(id));
                  }}
                />
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Lots secondaires optionnels</CardTitle>
                    <CardDescription>
                      Rattachez d&apos;autres lots existants à ce même bail. Le lot principal reste celui
                      défini au-dessus.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {availableSecondaryLots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun autre lot vacant disponible à rattacher.
                      </p>
                    ) : (
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                        {availableSecondaryLots.map((lot) => {
                          const checked = secondaryLotIds.includes(lot.id);
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
                                onChange={() => {
                                  setSecondaryLotIds((current) =>
                                    current.includes(lot.id)
                                      ? current.filter((id) => id !== lot.id)
                                      : [...current, lot.id]
                                  );
                                }}
                                className="h-4 w-4 rounded border-input"
                              />
                              <span className="truncate">{lotLabel(lot)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {secondaryLotIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {secondaryLotIds.length} lots secondaires sélectionnés
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
              <SectionLocataire
                form={tenantForm}
                onChange={updateTenantForm}
                tenants={tenants}
                useExisting={useExistingTenant}
                existingId={existingTenantId}
                onToggleExisting={() => {
                  setUseExistingTenant((current) => !current);
                  setExistingTenantId("");
                }}
                onExistingChange={(id) => {
                  setExistingTenantId(id);
                  setUseExistingTenant(Boolean(id));
                }}
              />
            </div>
          </>
        )}

        {creationMode === "workflow" && (
          <Card>
            <CardHeader>
              <CardTitle>Parties au bail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Lot(s) concerné(s) *</Label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Sélectionnez un ou plusieurs lots (ex : local + parking + cave).
                  Le premier lot coché sera le lot principal du bail.
                </p>
                {lots.filter((lot) => lot.status === "VACANT").length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucun lot vacant disponible.{" "}
                    <Link href="/patrimoine/immeubles" className="underline">
                      Gérer les lots
                    </Link>
                  </p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                    {lots
                      .filter((lot) => lot.status === "VACANT")
                      .map((lot) => {
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
                              onChange={() => {
                                setSelectedLotIds((previous) =>
                                  previous.includes(lot.id)
                                    ? previous.filter((id) => id !== lot.id)
                                    : [...previous, lot.id]
                                );
                              }}
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
                {selectedLotIds.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedLotIds.length} lots sélectionnés
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantId">Locataire *</Label>
                <select
                  id="tenantId"
                  name="tenantId"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Sélectionner un locataire...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenantLabel(tenant)} — {tenant.email}
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
        )}

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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
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
                  value={baseRentHT}
                  onChange={(e) => setBaseRentHT(e.target.value)}
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
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
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
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
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
                  value={rentFreeMonths}
                  onChange={(e) => setRentFreeMonths(e.target.value)}
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
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
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
                  value={baseIndexValue}
                  onChange={(e) => setBaseIndexValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseIndexQuarter">Trimestre de référence</Label>
                <Input
                  id="baseIndexQuarter"
                  name="baseIndexQuarter"
                  placeholder="Ex: T1 2024"
                  value={baseIndexQuarter}
                  onChange={(e) => setBaseIndexQuarter(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="revisionFrequency">Fréquence de révision (mois)</Label>
                <Input
                  id="revisionFrequency"
                  name="revisionFrequency"
                  type="number"
                  min={1}
                  value={revisionFrequency}
                  onChange={(e) => setRevisionFrequency(e.target.value)}
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
                    value={revisionCustomDay}
                    onChange={(e) => setRevisionCustomDay(e.target.value)}
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
                    value={revisionCustomMonth}
                    onChange={(e) => setRevisionCustomMonth(e.target.value)}
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
                placeholder="Travaux autorisés, conditions de restitution des lieux..."
                value={tenantWorksClauses}
                onChange={(e) => setTenantWorksClauses(e.target.value)}
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
          <Button type="submit" disabled={isLoading || isAnalyzingPdf}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création...
              </>
            ) : isAnalyzingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse du bail...
              </>
            ) : (
              pageCopy.submitLabel
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
