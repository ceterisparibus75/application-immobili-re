"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  CheckCircle2,
  Building2,
  Layers,
  Users,
  ScrollText,
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Bot,
  ExternalLink,
} from "lucide-react";
import { useSociety } from "@/providers/society-provider";
import { importFromPdf, type ImportInput, type ImportResult } from "@/actions/import";
import { getBuildings } from "@/actions/building";
import { getActiveTenants } from "@/actions/tenant";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type BuildingOption = { id: string; name: string; city: string };
type TenantOption = {
  id: string;
  entityType: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

type ImmeubleForm = {
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

type LocataireForm = {
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

type BailForm = {
  leaseType: string;
  startDate: string;
  durationMonths: string;
  baseRentHT: string;
  depositAmount: string;
  paymentFrequency: string;
  vatApplicable: boolean;
  vatRate: string;
  indexType: string;
  rentFreeMonths: string;
  entryFee: string;
  tenantWorksClauses: string;
};

type ReviewForm = {
  immeuble: ImmeubleForm;
  lot: LotForm;
  locataire: LocataireForm;
  bail: BailForm;
};

// ─── Constants ───────────────────────────────────────────────────────────────

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

const LEASE_TYPE_OPTIONS = [
  { value: "COMMERCIAL_369", label: "Bail commercial 3-6-9" },
  { value: "DEROGATOIRE", label: "Bail dérogatoire" },
  { value: "PRECAIRE", label: "Convention d'occupation précaire" },
];

const PAYMENT_FREQ_OPTIONS = [
  { value: "MENSUEL", label: "Mensuel" },
  { value: "TRIMESTRIEL", label: "Trimestriel" },
];

const INDEX_TYPE_OPTIONS = [
  { value: "", label: "Aucun" },
  { value: "ILC", label: "ILC — Indice des Loyers Commerciaux" },
  { value: "ILAT", label: "ILAT — Activités tertiaires" },
  { value: "ICC", label: "ICC — Construction" },
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

// ─── Helper ───────────────────────────────────────────────────────────────────

function tenantLabel(t: TenantOption) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? t.email)
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.email;
}

function emptyReview(): ReviewForm {
  return {
    immeuble: { name: "", addressLine1: "", city: "", postalCode: "", buildingType: "COMMERCE" },
    lot: { number: "", lotType: "LOCAL_COMMERCIAL", area: "", floor: "", position: "" },
    locataire: {
      entityType: "PERSONNE_MORALE",
      companyName: "", companyLegalForm: "", siret: "",
      legalRepName: "", legalRepTitle: "", legalRepEmail: "", legalRepPhone: "",
      firstName: "", lastName: "",
      email: "", phone: "", mobile: "",
    },
    bail: {
      leaseType: "COMMERCIAL_369", startDate: "", durationMonths: "108",
      baseRentHT: "", depositAmount: "0",
      paymentFrequency: "MENSUEL", vatApplicable: true, vatRate: "20",
      indexType: "", rentFreeMonths: "0", entryFee: "0", tenantWorksClauses: "",
    },
  };
}

function aiToForm(ai: Record<string, unknown>): ReviewForm {
  const base = emptyReview();
  const imm = (ai.immeuble ?? {}) as Record<string, unknown>;
  const lot = (ai.lot ?? {}) as Record<string, unknown>;
  const loc = (ai.locataire ?? {}) as Record<string, unknown>;
  const bail = (ai.bail ?? {}) as Record<string, unknown>;

  return {
    immeuble: {
      name: String(imm.name ?? ""),
      addressLine1: String(imm.addressLine1 ?? ""),
      city: String(imm.city ?? ""),
      postalCode: String(imm.postalCode ?? ""),
      buildingType: String(imm.buildingType ?? "COMMERCE"),
    },
    lot: {
      number: String(lot.number ?? ""),
      lotType: String(lot.lotType ?? "LOCAL_COMMERCIAL"),
      area: lot.area != null ? String(lot.area) : "",
      floor: String(lot.floor ?? ""),
      position: String(lot.position ?? ""),
    },
    locataire: {
      entityType: (loc.entityType === "PERSONNE_PHYSIQUE" ? "PERSONNE_PHYSIQUE" : "PERSONNE_MORALE") as "PERSONNE_MORALE" | "PERSONNE_PHYSIQUE",
      companyName: String(loc.companyName ?? ""),
      companyLegalForm: String(loc.companyLegalForm ?? ""),
      siret: String(loc.siret ?? ""),
      legalRepName: String(loc.legalRepName ?? ""),
      legalRepTitle: String(loc.legalRepTitle ?? ""),
      legalRepEmail: String(loc.legalRepEmail ?? ""),
      legalRepPhone: String(loc.legalRepPhone ?? ""),
      firstName: String(loc.firstName ?? ""),
      lastName: String(loc.lastName ?? ""),
      email: String(loc.email ?? base.locataire.email),
      phone: String(loc.phone ?? ""),
      mobile: String(loc.mobile ?? ""),
    },
    bail: {
      leaseType: String(bail.leaseType ?? "COMMERCIAL_369"),
      startDate: String(bail.startDate ?? ""),
      durationMonths: bail.durationMonths != null ? String(bail.durationMonths) : "108",
      baseRentHT: bail.baseRentHT != null ? String(bail.baseRentHT) : "",
      depositAmount: bail.depositAmount != null ? String(bail.depositAmount) : "0",
      paymentFrequency: String(bail.paymentFrequency ?? "MENSUEL"),
      vatApplicable: bail.vatApplicable !== false,
      vatRate: bail.vatRate != null ? String(bail.vatRate) : "20",
      indexType: bail.indexType != null && bail.indexType !== "null" ? String(bail.indexType) : "",
      rentFreeMonths: bail.rentFreeMonths != null ? String(bail.rentFreeMonths) : "0",
      entryFee: bail.entryFee != null ? String(bail.entryFee) : "0",
      tenantWorksClauses: String(bail.tenantWorksClauses ?? ""),
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionImmeuble({
  form, onChange, buildings, useExisting, existingId,
  onToggleExisting, onExistingChange,
}: {
  form: ImmeubleForm;
  onChange: (updates: Partial<ImmeubleForm>) => void;
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
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
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
            <Select
              value={existingId}
              onChange={(e) => onExistingChange(e.target.value)}
              options={buildings.map((b) => ({ value: b.id, label: `${b.name} — ${b.city}` }))}
              placeholder="— Sélectionner —"
            />
          </FieldRow>
        ) : (
          <>
            <FieldRow label="Nom *">
              <Input value={form.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ex: Immeuble du Centre" className="h-8 text-sm" />
            </FieldRow>
            <FieldRow label="Adresse *">
              <Input value={form.addressLine1} onChange={(e) => onChange({ addressLine1: e.target.value })} placeholder="12 rue de la Paix" className="h-8 text-sm" />
            </FieldRow>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Ville *">
                <Input value={form.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="Paris" className="h-8 text-sm" />
              </FieldRow>
              <FieldRow label="Code postal *">
                <Input value={form.postalCode} onChange={(e) => onChange({ postalCode: e.target.value })} placeholder="75001" className="h-8 text-sm" />
              </FieldRow>
            </div>
            <FieldRow label="Type *">
              <Select
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

function SectionLot({ form, onChange }: { form: LotForm; onChange: (u: Partial<LotForm>) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-green-500" />
          Lot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Numéro *">
            <Input value={form.number} onChange={(e) => onChange({ number: e.target.value })} placeholder="A1" className="h-8 text-sm" />
          </FieldRow>
          <FieldRow label="Surface (m²) *">
            <Input type="number" value={form.area} onChange={(e) => onChange({ area: e.target.value })} placeholder="120" className="h-8 text-sm" />
          </FieldRow>
        </div>
        <FieldRow label="Type *">
          <Select
            value={form.lotType}
            onChange={(e) => onChange({ lotType: e.target.value })}
            options={LOT_TYPE_OPTIONS}
          />
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Étage">
            <Input value={form.floor} onChange={(e) => onChange({ floor: e.target.value })} placeholder="RDC" className="h-8 text-sm" />
          </FieldRow>
          <FieldRow label="Position">
            <Input value={form.position} onChange={(e) => onChange({ position: e.target.value })} placeholder="Aile droite" className="h-8 text-sm" />
          </FieldRow>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionLocataire({
  form, onChange, tenants, useExisting, existingId,
  onToggleExisting, onExistingChange,
}: {
  form: LocataireForm;
  onChange: (u: Partial<LocataireForm>) => void;
  tenants: TenantOption[];
  useExisting: boolean;
  existingId: string;
  onToggleExisting: () => void;
  onExistingChange: (id: string) => void;
}) {
  const isMorale = form.entityType === "PERSONNE_MORALE";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-purple-500" />
          Locataire
        </CardTitle>
        {tenants.length > 0 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
            <input type="checkbox" checked={useExisting} onChange={onToggleExisting} className="h-4 w-4" />
            Utiliser un locataire existant
          </label>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {useExisting ? (
          <FieldRow label="Locataire *">
            <Select
              value={existingId}
              onChange={(e) => onExistingChange(e.target.value)}
              options={tenants.map((t) => ({ value: t.id, label: `${tenantLabel(t)} — ${t.email}` }))}
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
                    "flex-1 py-1.5 text-xs rounded-md border transition-colors",
                    form.entityType === type
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  {type === "PERSONNE_MORALE" ? "Personne morale" : "Personne physique"}
                </button>
              ))}
            </div>

            {isMorale ? (
              <>
                <FieldRow label="Raison sociale *">
                  <Input value={form.companyName} onChange={(e) => onChange({ companyName: e.target.value })} placeholder="Société ACME" className="h-8 text-sm" />
                </FieldRow>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Forme juridique">
                    <Select value={form.companyLegalForm} onChange={(e) => onChange({ companyLegalForm: e.target.value })} options={LEGAL_FORM_OPTIONS} />
                  </FieldRow>
                  <FieldRow label="SIRET">
                    <Input value={form.siret} onChange={(e) => onChange({ siret: e.target.value })} placeholder="12345678901234" className="h-8 text-sm" />
                  </FieldRow>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Représentant légal">
                    <Input value={form.legalRepName} onChange={(e) => onChange({ legalRepName: e.target.value })} placeholder="Jean Dupont" className="h-8 text-sm" />
                  </FieldRow>
                  <FieldRow label="Qualité">
                    <Input value={form.legalRepTitle} onChange={(e) => onChange({ legalRepTitle: e.target.value })} placeholder="Gérant" className="h-8 text-sm" />
                  </FieldRow>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Email représentant">
                    <Input type="email" value={form.legalRepEmail} onChange={(e) => onChange({ legalRepEmail: e.target.value })} className="h-8 text-sm" />
                  </FieldRow>
                  <FieldRow label="Tél. représentant">
                    <Input value={form.legalRepPhone} onChange={(e) => onChange({ legalRepPhone: e.target.value })} className="h-8 text-sm" />
                  </FieldRow>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <FieldRow label="Prénom *">
                  <Input value={form.firstName} onChange={(e) => onChange({ firstName: e.target.value })} className="h-8 text-sm" />
                </FieldRow>
                <FieldRow label="Nom *">
                  <Input value={form.lastName} onChange={(e) => onChange({ lastName: e.target.value })} className="h-8 text-sm" />
                </FieldRow>
              </div>
            )}

            <Separator />
            <FieldRow label="Email *">
              <Input type="email" value={form.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="contact@societe.fr" className="h-8 text-sm" />
            </FieldRow>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Téléphone">
                <Input value={form.phone} onChange={(e) => onChange({ phone: e.target.value })} className="h-8 text-sm" />
              </FieldRow>
              <FieldRow label="Mobile">
                <Input value={form.mobile} onChange={(e) => onChange({ mobile: e.target.value })} className="h-8 text-sm" />
              </FieldRow>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SectionBail({ form, onChange }: { form: BailForm; onChange: (u: Partial<BailForm>) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-orange-500" />
          Bail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FieldRow label="Type de bail *">
          <Select value={form.leaseType} onChange={(e) => onChange({ leaseType: e.target.value })} options={LEASE_TYPE_OPTIONS} />
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Date de début *">
            <Input type="date" value={form.startDate} onChange={(e) => onChange({ startDate: e.target.value })} className="h-8 text-sm" />
          </FieldRow>
          <FieldRow label="Durée (mois) *">
            <Input type="number" value={form.durationMonths} onChange={(e) => onChange({ durationMonths: e.target.value })} placeholder="108" className="h-8 text-sm" />
          </FieldRow>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Loyer HT/mois *">
            <Input type="number" value={form.baseRentHT} onChange={(e) => onChange({ baseRentHT: e.target.value })} placeholder="2000" className="h-8 text-sm" />
          </FieldRow>
          <FieldRow label="Dépôt de garantie">
            <Input type="number" value={form.depositAmount} onChange={(e) => onChange({ depositAmount: e.target.value })} placeholder="0" className="h-8 text-sm" />
          </FieldRow>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Périodicité">
            <Select value={form.paymentFrequency} onChange={(e) => onChange({ paymentFrequency: e.target.value })} options={PAYMENT_FREQ_OPTIONS} />
          </FieldRow>
          <FieldRow label="Indice révision">
            <Select value={form.indexType} onChange={(e) => onChange({ indexType: e.target.value })} options={INDEX_TYPE_OPTIONS} />
          </FieldRow>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FieldRow label="TVA (%)">
            <Input type="number" value={form.vatRate} onChange={(e) => onChange({ vatRate: e.target.value })} className="h-8 text-sm" />
          </FieldRow>
          <FieldRow label="Mois franchise">
            <Input type="number" value={form.rentFreeMonths} onChange={(e) => onChange({ rentFreeMonths: e.target.value })} className="h-8 text-sm" />
          </FieldRow>
          <FieldRow label="Droit d'entrée">
            <Input type="number" value={form.entryFee} onChange={(e) => onChange({ entryFee: e.target.value })} className="h-8 text-sm" />
          </FieldRow>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.vatApplicable}
            onChange={(e) => onChange({ vatApplicable: e.target.checked })}
            className="h-4 w-4"
          />
          TVA applicable
        </label>
        <FieldRow label="Clauses travaux preneur">
          <Textarea
            value={form.tenantWorksClauses}
            onChange={(e) => onChange({ tenantWorksClauses: e.target.value })}
            placeholder="Travaux à la charge du preneur..."
            className="text-sm min-h-[60px]"
          />
        </FieldRow>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const societyId = activeSociety?.id;

  const [step, setStep] = useState<"upload" | "review" | "success">("upload");
  const [isPending, startTransition] = useTransition();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [importError, setImportError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ReviewForm>(emptyReview());
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [useExistingBuilding, setUseExistingBuilding] = useState(false);
  const [existingBuildingId, setExistingBuildingId] = useState("");
  const [useExistingTenant, setUseExistingTenant] = useState(false);
  const [existingTenantId, setExistingTenantId] = useState("");

  const [result, setResult] = useState<ImportResult | null>(null);

  // Load buildings & tenants
  useEffect(() => {
    if (!societyId) return;
    getBuildings(societyId).then((list) =>
      setBuildings(list.map((b) => ({ id: b.id, name: b.name, city: b.city })))
    );
    getActiveTenants(societyId).then(setTenants);
  }, [societyId]);

  // File handlers
  function handleFileSelect(selected: File | null) {
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      setAnalyzeError("Seuls les fichiers PDF sont acceptés");
      return;
    }
    setFile(selected);
    setAnalyzeError("");
  }

  async function handleAnalyze() {
    if (!file || !societyId) return;
    setIsAnalyzing(true);
    setAnalyzeError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/analyze", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setAnalyzeError(data.error ?? "Erreur lors de l'analyse");
        return;
      }

      setForm(aiToForm(data));
      setStep("review");
    } catch {
      setAnalyzeError("Erreur de connexion");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updateImmeuble(updates: Partial<ImmeubleForm>) {
    setForm((f) => ({ ...f, immeuble: { ...f.immeuble, ...updates } }));
  }
  function updateLot(updates: Partial<LotForm>) {
    setForm((f) => ({ ...f, lot: { ...f.lot, ...updates } }));
  }
  function updateLocataire(updates: Partial<LocataireForm>) {
    setForm((f) => ({ ...f, locataire: { ...f.locataire, ...updates } }));
  }
  function updateBail(updates: Partial<BailForm>) {
    setForm((f) => ({ ...f, bail: { ...f.bail, ...updates } }));
  }

  function validateForm(): string | null {
    if (!useExistingBuilding) {
      if (!form.immeuble.name) return "Nom de l'immeuble requis";
      if (!form.immeuble.addressLine1) return "Adresse de l'immeuble requise";
      if (!form.immeuble.city) return "Ville requise";
      if (!form.immeuble.postalCode) return "Code postal requis";
    } else if (!existingBuildingId) {
      return "Sélectionner un immeuble existant";
    }
    if (!form.lot.number) return "Numéro de lot requis";
    if (!form.lot.area || isNaN(parseFloat(form.lot.area))) return "Surface du lot requise";
    if (!useExistingTenant) {
      if (!form.locataire.email) return "Email du locataire requis";
      if (form.locataire.entityType === "PERSONNE_MORALE" && !form.locataire.companyName) return "Raison sociale requise";
      if (form.locataire.entityType === "PERSONNE_PHYSIQUE" && (!form.locataire.firstName || !form.locataire.lastName)) return "Prénom et nom du locataire requis";
    } else if (!existingTenantId) {
      return "Sélectionner un locataire existant";
    }
    if (!form.bail.startDate) return "Date de début du bail requise";
    if (!form.bail.baseRentHT || isNaN(parseFloat(form.bail.baseRentHT))) return "Loyer HT requis";
    return null;
  }

  function handleImport() {
    if (!societyId) return;
    const err = validateForm();
    if (err) { setImportError(err); return; }
    setImportError("");

    const input: ImportInput = {
      building: {
        existingId: useExistingBuilding ? existingBuildingId : undefined,
        name: form.immeuble.name,
        addressLine1: form.immeuble.addressLine1,
        city: form.immeuble.city,
        postalCode: form.immeuble.postalCode,
        buildingType: form.immeuble.buildingType as ImportInput["building"]["buildingType"],
      },
      lot: {
        number: form.lot.number,
        lotType: form.lot.lotType as ImportInput["lot"]["lotType"],
        area: parseFloat(form.lot.area),
        floor: form.lot.floor || null,
        position: form.lot.position || null,
      },
      tenant: {
        existingId: useExistingTenant ? existingTenantId : undefined,
        entityType: form.locataire.entityType,
        companyName: form.locataire.companyName || null,
        companyLegalForm: form.locataire.companyLegalForm || null,
        siret: form.locataire.siret || null,
        legalRepName: form.locataire.legalRepName || null,
        legalRepTitle: form.locataire.legalRepTitle || null,
        legalRepEmail: form.locataire.legalRepEmail || null,
        legalRepPhone: form.locataire.legalRepPhone || null,
        firstName: form.locataire.firstName || null,
        lastName: form.locataire.lastName || null,
        email: form.locataire.email,
        phone: form.locataire.phone || null,
        mobile: form.locataire.mobile || null,
      },
      lease: {
        leaseType: form.bail.leaseType as ImportInput["lease"]["leaseType"],
        startDate: form.bail.startDate,
        durationMonths: parseInt(form.bail.durationMonths) || 108,
        baseRentHT: parseFloat(form.bail.baseRentHT),
        depositAmount: parseFloat(form.bail.depositAmount) || 0,
        paymentFrequency: form.bail.paymentFrequency as ImportInput["lease"]["paymentFrequency"],
        vatApplicable: form.bail.vatApplicable,
        vatRate: parseFloat(form.bail.vatRate) || 20,
        indexType: (form.bail.indexType || null) as ImportInput["lease"]["indexType"],
        rentFreeMonths: parseInt(form.bail.rentFreeMonths) || 0,
        entryFee: parseFloat(form.bail.entryFee) || 0,
        tenantWorksClauses: form.bail.tenantWorksClauses || null,
      },
    };

    startTransition(async () => {
      const res = await importFromPdf(societyId, input);
      if (res.success && res.data) {
        setResult(res.data);
        setStep("success");
      } else {
        setImportError(res.error ?? "Erreur lors de l'import");
      }
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import par PDF</h1>
          <p className="text-muted-foreground text-sm">
            Importez un bail PDF — l&apos;IA extrait automatiquement les données
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "review", "success"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
              step === s ? "bg-primary text-primary-foreground" :
              (["upload", "review", "success"].indexOf(step) > i)
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            )}>
              {i + 1}
            </div>
            <span className={cn(
              "text-xs",
              step === s ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {s === "upload" ? "Importation PDF" : s === "review" ? "Vérification" : "Terminé"}
            </span>
            {i < 2 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <Card>
          <CardContent className="pt-6">
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFileSelect(e.dataTransfer.files[0] ?? null);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <FileText className="h-12 w-12 text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                  <Badge variant="outline">PDF sélectionné</Badge>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Glissez un PDF ou cliquez pour sélectionner</p>
                    <p className="text-sm text-muted-foreground mt-1">Bail commercial, dérogatoire ou précaire — max 15 Mo</p>
                  </div>
                </div>
              )}
            </div>

            {analyzeError && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {analyzeError}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button onClick={handleAnalyze} disabled={!file || isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse en cours…
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Analyser avec l&apos;IA
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <>
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
            <Bot className="h-4 w-4 shrink-0" />
            Données extraites par l&apos;IA — vérifiez et corrigez si nécessaire avant d&apos;importer
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <SectionImmeuble
                form={form.immeuble}
                onChange={updateImmeuble}
                buildings={buildings}
                useExisting={useExistingBuilding}
                existingId={existingBuildingId}
                onToggleExisting={() => { setUseExistingBuilding((v) => !v); setExistingBuildingId(""); }}
                onExistingChange={setExistingBuildingId}
              />
              <SectionLot form={form.lot} onChange={updateLot} />
            </div>
            <div className="space-y-4">
              <SectionLocataire
                form={form.locataire}
                onChange={updateLocataire}
                tenants={tenants}
                useExisting={useExistingTenant}
                existingId={existingTenantId}
                onToggleExisting={() => { setUseExistingTenant((v) => !v); setExistingTenantId(""); }}
                onExistingChange={setExistingTenantId}
              />
              <SectionBail form={form.bail} onChange={updateBail} />
            </div>
          </div>

          {importError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {importError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => { setStep("upload"); setImportError(""); }}>
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            <Button onClick={handleImport} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isPending ? "Import en cours…" : "Importer"}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 3: Success ── */}
      {step === "success" && result && (
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div>
                <h2 className="text-xl font-bold">Import réalisé avec succès</h2>
                <p className="text-muted-foreground mt-1">
                  L&apos;immeuble, le lot, le locataire et le bail ont été créés
                </p>
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                <Link href={`/patrimoine/immeubles/${result.buildingId}`}>
                  <Button variant="outline" size="sm">
                    <Building2 className="h-4 w-4" />
                    Voir l&apos;immeuble
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href={`/locataires/${result.tenantId}`}>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4" />
                    Voir le locataire
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href={`/baux/${result.leaseId}`}>
                  <Button size="sm">
                    <ScrollText className="h-4 w-4" />
                    Voir le bail
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setForm(emptyReview());
                  setResult(null);
                  setUseExistingBuilding(false);
                  setUseExistingTenant(false);
                  setExistingBuildingId("");
                  setExistingTenantId("");
                }}
              >
                Importer un autre bail
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
