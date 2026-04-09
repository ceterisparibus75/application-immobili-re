"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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
import { importFromPdf, analyzePdfAction, type ImportInput, type ImportResult } from "@/actions/import";
import { AiConfirmDialog } from "@/components/ai-confirm-dialog";
import { getBuildings } from "@/actions/building";
import { getActiveTenants } from "@/actions/tenant";
import { getLots } from "@/actions/lot";
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

type LotOption = {
  id: string;
  number: string;
  lotType: string;
  area: number;
  status: string;
  building: { id: string; name: string };
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
  destination: string;
  startDate: string;
  durationMonths: string;
  baseRentHT: string;
  depositAmount: string;
  paymentFrequency: string;
  vatApplicable: boolean;
  vatRate: string;
  indexType: string;
  baseIndexValue: string;
  baseIndexQuarter: string;
  revisionFrequency: string;
  revisionDateBasis: string;
  revisionCustomMonth: string;
  revisionCustomDay: string;
  rentFreeMonths: string;
  entryFee: string;
  tenantWorksClauses: string;
  isThirdPartyManaged: boolean;
  managingContactId: string;
  managementFeeType: string;
  managementFeeValue: string;
  managementFeeBasis: string;
  managementFeeVatRate: string;
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
  { value: "HABITATION", label: "Bail d'habitation vide (loi 1989)" },
  { value: "MEUBLE", label: "Bail meublé (ALUR)" },
  { value: "ETUDIANT", label: "Bail étudiant meublé (9 mois)" },
  { value: "MOBILITE", label: "Bail mobilité (ELAN)" },
  { value: "COLOCATION", label: "Bail colocation" },
  { value: "SAISONNIER", label: "Location saisonnière" },
  { value: "LOGEMENT_FONCTION", label: "Logement de fonction" },
  { value: "ANAH", label: "Convention ANAH" },
  { value: "CIVIL", label: "Bail civil (Code civil)" },
  { value: "GLISSANT", label: "Bail glissant" },
  { value: "SOUS_LOCATION", label: "Sous-location" },
  { value: "COMMERCIAL_369", label: "Bail commercial 3-6-9" },
  { value: "DEROGATOIRE", label: "Bail dérogatoire" },
  { value: "PRECAIRE", label: "Convention d'occupation précaire" },
  { value: "BAIL_PROFESSIONNEL", label: "Bail professionnel" },
  { value: "MIXTE", label: "Bail mixte" },
  { value: "EMPHYTEOTIQUE", label: "Bail emphytéotique" },
  { value: "CONSTRUCTION", label: "Bail à construction" },
  { value: "REHABILITATION", label: "Bail à réhabilitation" },
  { value: "BRS", label: "Bail réel solidaire (OFS)" },
  { value: "RURAL", label: "Bail rural / agricole" },
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

const PAYMENT_FREQ_OPTIONS = [
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

const INDEX_TYPE_OPTIONS = [
  { value: "", label: "Aucun" },
  { value: "IRL", label: "IRL — Référence des Loyers" },
  { value: "ILC", label: "ILC — Loyers Commerciaux" },
  { value: "ILAT", label: "ILAT — Activités tertiaires" },
  { value: "ICC", label: "ICC — Construction" },
];

const REVISION_DATE_BASIS_OPTIONS = [
  { value: "DATE_SIGNATURE", label: "Date anniversaire du bail" },
  { value: "DATE_ENTREE", label: "Date d'entrée dans les lieux" },
  { value: "PREMIER_JANVIER", label: "1er janvier" },
  { value: "DATE_PERSONNALISEE", label: "Date personnalisée" },
];

const FEE_TYPE_OPTIONS = [
  { value: "POURCENTAGE", label: "Pourcentage" },
  { value: "FORFAIT", label: "Forfait" },
];

const FEE_BASIS_OPTIONS = [
  { value: "LOYER_HT", label: "Loyer HT" },
  { value: "LOYER_CHARGES_HT", label: "Loyer + charges HT" },
  { value: "TOTAL_TTC", label: "Total TTC" },
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
      leaseType: "COMMERCIAL_369", destination: "", startDate: "", durationMonths: "108",
      baseRentHT: "", depositAmount: "0",
      paymentFrequency: "MENSUEL", vatApplicable: true, vatRate: "20",
      indexType: "", baseIndexValue: "", baseIndexQuarter: "", revisionFrequency: "12",
      revisionDateBasis: "DATE_SIGNATURE", revisionCustomMonth: "", revisionCustomDay: "",
      rentFreeMonths: "0", entryFee: "0", tenantWorksClauses: "",
      isThirdPartyManaged: false, managingContactId: "",
      managementFeeType: "POURCENTAGE", managementFeeValue: "0",
      managementFeeBasis: "LOYER_HT", managementFeeVatRate: "20",
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
      destination: bail.destination != null && bail.destination !== "null" ? String(bail.destination) : "",
      startDate: String(bail.startDate ?? ""),
      durationMonths: bail.durationMonths != null ? String(bail.durationMonths) : "108",
      baseRentHT: bail.baseRentHT != null ? String(bail.baseRentHT) : "",
      depositAmount: bail.depositAmount != null ? String(bail.depositAmount) : "0",
      paymentFrequency: String(bail.paymentFrequency ?? "MENSUEL"),
      vatApplicable: bail.vatApplicable !== false,
      vatRate: bail.vatRate != null ? String(bail.vatRate) : "20",
      indexType: bail.indexType != null && bail.indexType !== "null" ? String(bail.indexType) : "",
      baseIndexValue: bail.baseIndexValue != null ? String(bail.baseIndexValue) : "",
      baseIndexQuarter: bail.baseIndexQuarter != null ? String(bail.baseIndexQuarter) : "",
      revisionFrequency: bail.revisionFrequency != null ? String(bail.revisionFrequency) : "12",
      revisionDateBasis: bail.revisionDateBasis != null && bail.revisionDateBasis !== "null" ? String(bail.revisionDateBasis) : "DATE_SIGNATURE",
      revisionCustomMonth: bail.revisionCustomMonth != null ? String(bail.revisionCustomMonth) : "",
      revisionCustomDay: bail.revisionCustomDay != null ? String(bail.revisionCustomDay) : "",
      rentFreeMonths: bail.rentFreeMonths != null ? String(bail.rentFreeMonths) : "0",
      entryFee: bail.entryFee != null ? String(bail.entryFee) : "0",
      tenantWorksClauses: String(bail.tenantWorksClauses ?? ""),
      isThirdPartyManaged: bail.isThirdPartyManaged === true,
      managingContactId: "",
      managementFeeType: String(bail.managementFeeType ?? "POURCENTAGE"),
      managementFeeValue: bail.managementFeeValue != null ? String(bail.managementFeeValue) : "0",
      managementFeeBasis: String(bail.managementFeeBasis ?? "LOYER_HT"),
      managementFeeVatRate: bail.managementFeeVatRate != null ? String(bail.managementFeeVatRate) : "20",
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
            <NativeSelect
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
  form, onChange, lots, useExisting, existingId,
  onToggleExisting, onExistingChange,
}: {
  form: LotForm;
  onChange: (u: Partial<LotForm>) => void;
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
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
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
              options={lots.map((l) => ({
                value: l.id,
                label: `Lot ${l.number} — ${l.lotType} (${l.area} m²)`,
              }))}
              placeholder="— Sélectionner un lot —"
            />
          </FieldRow>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Numéro *">
                <Input value={form.number} onChange={(e) => onChange({ number: e.target.value })} placeholder="A1" className="h-8 text-sm" />
              </FieldRow>
              <FieldRow label="Surface (m²) *">
                <Input type="number" value={form.area} onChange={(e) => onChange({ area: e.target.value })} placeholder="120" className="h-8 text-sm" />
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
                <Input value={form.floor} onChange={(e) => onChange({ floor: e.target.value })} placeholder="RDC" className="h-8 text-sm" />
              </FieldRow>
              <FieldRow label="Position">
                <Input value={form.position} onChange={(e) => onChange({ position: e.target.value })} placeholder="Aile droite" className="h-8 text-sm" />
              </FieldRow>
            </div>
          </>
        )}
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
            <NativeSelect
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
                    <NativeSelect value={form.companyLegalForm} onChange={(e) => onChange({ companyLegalForm: e.target.value })} options={LEGAL_FORM_OPTIONS} />
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

type AgencyOption = { id: string; name: string; company: string | null };

function SectionBail({ form, onChange, agencies }: { form: BailForm; onChange: (u: Partial<BailForm>) => void; agencies: AgencyOption[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-[var(--color-status-caution)]" />
          Bail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Type de bail *">
            <NativeSelect value={form.leaseType} onChange={(e) => onChange({ leaseType: e.target.value })} options={LEASE_TYPE_OPTIONS} />
          </FieldRow>
          <FieldRow label="Destination">
            <NativeSelect value={form.destination} onChange={(e) => onChange({ destination: e.target.value })} options={DESTINATION_OPTIONS} />
          </FieldRow>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Date de début *">
            <Input type="date" value={form.startDate} onChange={(e) => onChange({ startDate: e.target.value })} className="h-8 text-sm" />
          </FieldRow>
          <FieldRow label="Durée (mois) *">
            <Input type="number" value={form.durationMonths} onChange={(e) => onChange({ durationMonths: e.target.value })} placeholder="108" className="h-8 text-sm" />
          </FieldRow>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label={`Loyer HT/${FREQ_PERIOD_LABELS[form.paymentFrequency] ?? "mois"} *`}>
            <Input type="number" value={form.baseRentHT} onChange={(e) => onChange({ baseRentHT: e.target.value })} placeholder="2000" className="h-8 text-sm" />
          </FieldRow>
          <FieldRow label="Dépôt de garantie">
            <Input type="number" value={form.depositAmount} onChange={(e) => onChange({ depositAmount: e.target.value })} placeholder="0" className="h-8 text-sm" />
          </FieldRow>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Périodicité">
            <NativeSelect value={form.paymentFrequency} onChange={(e) => onChange({ paymentFrequency: e.target.value })} options={PAYMENT_FREQ_OPTIONS} />
          </FieldRow>
          <FieldRow label="Indice révision">
            <NativeSelect value={form.indexType} onChange={(e) => onChange({ indexType: e.target.value })} options={INDEX_TYPE_OPTIONS} />
          </FieldRow>
        </div>
        {form.indexType && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <FieldRow label="Valeur indice de base">
                <Input type="number" step="0.01" value={form.baseIndexValue} onChange={(e) => onChange({ baseIndexValue: e.target.value })} placeholder="142.06" className="h-8 text-sm" />
              </FieldRow>
              <FieldRow label="Trimestre réf.">
                <Input value={form.baseIndexQuarter} onChange={(e) => onChange({ baseIndexQuarter: e.target.value })} placeholder="T1 2021" className="h-8 text-sm" />
              </FieldRow>
              <FieldRow label="Fréq. révision (mois)">
                <Input type="number" value={form.revisionFrequency} onChange={(e) => onChange({ revisionFrequency: e.target.value })} placeholder="12" className="h-8 text-sm" />
              </FieldRow>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Date de révision">
                <NativeSelect value={form.revisionDateBasis} onChange={(e) => onChange({ revisionDateBasis: e.target.value })} options={REVISION_DATE_BASIS_OPTIONS} />
              </FieldRow>
              {form.revisionDateBasis === "DATE_PERSONNALISEE" && (
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Jour">
                    <Input type="number" min={1} max={31} value={form.revisionCustomDay} onChange={(e) => onChange({ revisionCustomDay: e.target.value })} placeholder="1" className="h-8 text-sm" />
                  </FieldRow>
                  <FieldRow label="Mois">
                    <Input type="number" min={1} max={12} value={form.revisionCustomMonth} onChange={(e) => onChange({ revisionCustomMonth: e.target.value })} placeholder="1" className="h-8 text-sm" />
                  </FieldRow>
                </div>
              )}
            </div>
          </>
        )}
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
        <Separator />
        <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
          <input
            type="checkbox"
            checked={form.isThirdPartyManaged}
            onChange={(e) => onChange({ isThirdPartyManaged: e.target.checked })}
            className="h-4 w-4"
          />
          Gestion par un tiers (mandat de gestion)
        </label>
        {form.isThirdPartyManaged && (
          <div className="space-y-3 rounded-md border p-3 bg-muted/30">
            <FieldRow label="Agence de gestion">
              <NativeSelect
                value={form.managingContactId}
                onChange={(e) => onChange({ managingContactId: e.target.value })}
                options={[
                  { value: "", label: "— Sélectionner une agence —" },
                  ...agencies.map((a) => ({ value: a.id, label: a.company ? `${a.name} (${a.company})` : a.name })),
                ]}
              />
            </FieldRow>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Type d'honoraires">
                <NativeSelect value={form.managementFeeType} onChange={(e) => onChange({ managementFeeType: e.target.value })} options={FEE_TYPE_OPTIONS} />
              </FieldRow>
              <FieldRow label={form.managementFeeType === "POURCENTAGE" ? "Taux (%)" : "Montant forfaitaire (€)"}>
                <Input type="number" step="0.01" value={form.managementFeeValue} onChange={(e) => onChange({ managementFeeValue: e.target.value })} placeholder={form.managementFeeType === "POURCENTAGE" ? "8" : "150"} className="h-8 text-sm" />
              </FieldRow>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Base de calcul">
                <NativeSelect value={form.managementFeeBasis} onChange={(e) => onChange({ managementFeeBasis: e.target.value })} options={FEE_BASIS_OPTIONS} />
              </FieldRow>
              <FieldRow label="TVA honoraires (%)">
                <Input type="number" step="0.1" value={form.managementFeeVatRate} onChange={(e) => onChange({ managementFeeVatRate: e.target.value })} placeholder="20" className="h-8 text-sm" />
              </FieldRow>
            </div>
          </div>
        )}
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
  const [useExistingLot, setUseExistingLot] = useState(false);
  const [existingLotId, setExistingLotId] = useState("");
  const [lots, setLots] = useState<LotOption[]>([]);
  const [useExistingTenant, setUseExistingTenant] = useState(false);
  const [existingTenantId, setExistingTenantId] = useState("");

  const [agencies, setAgencies] = useState<AgencyOption[]>([]);

  const [result, setResult] = useState<ImportResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load buildings, tenants & lots
  useEffect(() => {
    if (!societyId) return;
    getBuildings(societyId).then((list) =>
      setBuildings(list.map((b) => ({ id: b.id, name: b.name, city: b.city })))
    );
    getActiveTenants(societyId).then(setTenants);
    getLots(societyId).then((list) =>
      setLots(list.map((l) => ({
        id: l.id,
        number: l.number,
        lotType: l.lotType,
        area: l.area,
        status: l.status,
        building: { id: l.building.id, name: l.building.name },
      })))
    );
    fetch("/api/contacts?type=AGENCE")
      .then((r) => r.json())
      .then((res) => setAgencies(res.data ?? []))
      .catch(() => {});
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
      const result = await analyzePdfAction(fd);
      if (!result.success) {
        setAnalyzeError(result.error ?? "Erreur lors de l'analyse");
        return;
      }
      setForm(aiToForm(result.data as Record<string, unknown>));
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse";
      setAnalyzeError(msg);
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
    if (!useExistingLot) {
      if (!form.lot.number) return "Numéro de lot requis";
      if (!form.lot.area || isNaN(parseFloat(form.lot.area))) return "Surface du lot requise";
    } else if (!existingLotId) {
      return "Sélectionner un lot existant";
    }
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

  function doImport() {
    if (!societyId) return;
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
        existingId: useExistingLot ? existingLotId : undefined,
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
        destination: (form.bail.destination || null) as ImportInput["lease"]["destination"],
        startDate: form.bail.startDate,
        durationMonths: parseInt(form.bail.durationMonths) || 108,
        baseRentHT: parseFloat(form.bail.baseRentHT),
        depositAmount: parseFloat(form.bail.depositAmount) || 0,
        paymentFrequency: form.bail.paymentFrequency as ImportInput["lease"]["paymentFrequency"],
        vatApplicable: form.bail.vatApplicable,
        vatRate: parseFloat(form.bail.vatRate) || 20,
        indexType: (form.bail.indexType || null) as ImportInput["lease"]["indexType"],
        baseIndexValue: form.bail.baseIndexValue ? parseFloat(form.bail.baseIndexValue) : null,
        baseIndexQuarter: form.bail.baseIndexQuarter || null,
        revisionFrequency: parseInt(form.bail.revisionFrequency) || 12,
        revisionDateBasis: (form.bail.revisionDateBasis || "DATE_SIGNATURE") as ImportInput["lease"]["revisionDateBasis"],
        revisionCustomMonth: form.bail.revisionCustomMonth ? parseInt(form.bail.revisionCustomMonth) : null,
        revisionCustomDay: form.bail.revisionCustomDay ? parseInt(form.bail.revisionCustomDay) : null,
        rentFreeMonths: parseInt(form.bail.rentFreeMonths) || 0,
        entryFee: parseFloat(form.bail.entryFee) || 0,
        tenantWorksClauses: form.bail.tenantWorksClauses || null,
        isThirdPartyManaged: form.bail.isThirdPartyManaged,
        managingContactId: form.bail.managingContactId || null,
        managementFeeType: form.bail.isThirdPartyManaged ? (form.bail.managementFeeType || null) as ImportInput["lease"]["managementFeeType"] : null,
        managementFeeValue: form.bail.isThirdPartyManaged ? (parseFloat(form.bail.managementFeeValue) || null) : null,
        managementFeeBasis: form.bail.isThirdPartyManaged ? (form.bail.managementFeeBasis || null) as ImportInput["lease"]["managementFeeBasis"] : null,
        managementFeeVatRate: form.bail.isThirdPartyManaged ? (parseFloat(form.bail.managementFeeVatRate) || 20) : null,
      },
    };

    startTransition(async () => {
      const res = await importFromPdf(societyId, input);
      if (res.success && res.data) {
        // Auto-attach the PDF to the documents module
        if (file) {
          try {
            const docFd = new FormData();
            docFd.append("file", file);
            docFd.append("category", "bail");
            docFd.append("leaseId", res.data.leaseId);
            docFd.append("lotId", res.data.lotId);
            docFd.append("description", `Bail importé par IA — ${file.name}`);
            await fetch("/api/documents/upload", { method: "POST", body: docFd });
          } catch {
            // Document upload is best-effort, don't block the import
          }
        }
        setResult(res.data);
        setStep("success");
      } else {
        setImportError(res.error ?? "Erreur lors de l'import");
      }
    });
  }

  function handleImport() {
    if (!societyId) return;
    const err = validateForm();
    if (err) { setImportError(err); return; }
    setImportError("");
    setConfirmOpen(true);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const tenantName = useExistingTenant
    ? tenants.find((t) => t.id === existingTenantId) ? tenantLabel(tenants.find((t) => t.id === existingTenantId)!) : ""
    : form.locataire.entityType === "PERSONNE_MORALE"
      ? form.locataire.companyName
      : `${form.locataire.firstName} ${form.locataire.lastName}`.trim();

  const buildingName = useExistingBuilding
    ? buildings.find((b) => b.id === existingBuildingId)?.name ?? ""
    : form.immeuble.name;

  return (
    <div className="space-y-6 max-w-5xl">
      <AiConfirmDialog
        open={confirmOpen}
        description="Bail extrait depuis le PDF"
        lines={[
          { label: "Immeuble", value: buildingName },
          { label: "Lot", value: form.lot.number ? `Lot ${form.lot.number} — ${form.lot.lotType}` : undefined },
          { label: "Surface", value: form.lot.area ? `${form.lot.area} m²` : undefined },
          { label: "Locataire", value: tenantName },
          { label: "Type de bail", value: form.bail.leaseType },
          { label: "Destination", value: form.bail.destination || undefined },
          { label: "Loyer HT", value: form.bail.baseRentHT ? `${parseFloat(form.bail.baseRentHT).toLocaleString("fr-FR")} € / ${FREQ_PERIOD_LABELS[form.bail.paymentFrequency] ?? "mois"}` : undefined },
          { label: "Début", value: form.bail.startDate },
          { label: "Durée", value: form.bail.durationMonths ? `${form.bail.durationMonths} mois` : undefined },
          { label: "Indice", value: form.bail.indexType || undefined },
          { label: "Indice de base", value: form.bail.baseIndexValue ? `${form.bail.baseIndexValue} (${form.bail.baseIndexQuarter || "?"})` : undefined },
        ]}
        onConfirm={() => { setConfirmOpen(false); doImport(); }}
        onCancel={() => setConfirmOpen(false)}
      />

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
              <SectionLot
                form={form.lot}
                onChange={updateLot}
                lots={useExistingBuilding && existingBuildingId
                  ? lots.filter((l) => l.building.id === existingBuildingId && l.status === "VACANT")
                  : lots.filter((l) => l.status === "VACANT")}
                useExisting={useExistingLot}
                existingId={existingLotId}
                onToggleExisting={() => { setUseExistingLot((v) => !v); setExistingLotId(""); }}
                onExistingChange={setExistingLotId}
              />
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
              <SectionBail form={form.bail} onChange={updateBail} agencies={agencies} />
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
              <CheckCircle2 className="h-16 w-16 text-[var(--color-status-positive)]" />
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
