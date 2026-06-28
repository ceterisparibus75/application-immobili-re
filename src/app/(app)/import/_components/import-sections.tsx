"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import {
  BUILDING_TYPE_OPTIONS,
  LOT_TYPE_OPTIONS,
  LEASE_TYPE_OPTIONS,
  DESTINATION_OPTIONS,
  PAYMENT_FREQ_OPTIONS,
  FREQ_PERIOD_LABELS,
  INDEX_TYPE_OPTIONS,
  REVISION_DATE_BASIS_OPTIONS,
  FEE_TYPE_OPTIONS,
  FEE_BASIS_OPTIONS,
  LEGAL_FORM_OPTIONS,
  type BuildingOption,
  type LotOption,
  type TenantOption,
  type ImmeubleForm,
  type LotForm,
  type LocataireForm,
  type BailForm,
} from "./import-types";
import { Label } from "@/components/ui/label";
import { Building2, Layers, Users, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { tenantLabel } from "./import-helpers";

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function SectionImmeuble({
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

export function SectionLot({
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

export function SectionLocataire({
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

export type AgencyOption = { id: string; name: string; company: string | null };

export function SectionBail({ form, onChange, agencies }: { form: BailForm; onChange: (u: Partial<BailForm>) => void; agencies: AgencyOption[] }) {
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
        {form.paymentFrequency === "ANNUEL" && (
          <div className="rounded border bg-muted/30 p-2 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Date contractuelle d'échéance annuelle (laisser vide pour un cycle calendaire 1er janvier — 31 décembre). La 1ère facture sera proratisée entre la date d'entrée et cette échéance.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Jour anchor">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.billingAnchorDay}
                  onChange={(e) => onChange({ billingAnchorDay: e.target.value })}
                  placeholder="1"
                  className="h-8 text-sm"
                />
              </FieldRow>
              <FieldRow label="Mois anchor">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.billingAnchorMonth}
                  onChange={(e) => onChange({ billingAnchorMonth: e.target.value })}
                  placeholder="7 (juillet)"
                  className="h-8 text-sm"
                />
              </FieldRow>
            </div>
          </div>
        )}
        {form.indexType === "POURCENTAGE_FIXE" && (
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Taux annuel (%)">
              <Input
                type="number"
                step="0.01"
                min={-50}
                max={50}
                value={form.fixedAnnualIndexationRate}
                onChange={(e) => onChange({ fixedAnnualIndexationRate: e.target.value })}
                placeholder="2"
                className="h-8 text-sm"
              />
            </FieldRow>
            <FieldRow label="Fréq. révision (mois)">
              <Input type="number" value={form.revisionFrequency} onChange={(e) => onChange({ revisionFrequency: e.target.value })} placeholder="12" className="h-8 text-sm" />
            </FieldRow>
          </div>
        )}
        {form.indexType && form.indexType !== "POURCENTAGE_FIXE" && (
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
