"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProprietaire } from "@/actions/proprietaire";
import type { ProprietaireEntityType } from "@/generated/prisma/client";
import { toast } from "sonner";
import { Pencil, X, Save, User, Building2 } from "lucide-react";

const LEGAL_FORMS = ["SCI", "SARL", "SAS", "SA", "EURL", "SASU", "SNC", "Holding", "Autre"];

type ProprietaireData = {
  id: string;
  label: string;
  entityType: ProprietaireEntityType;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  birthDate: Date | null;
  birthPlace: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  profession: string | null;
  nationality: string | null;
  companyName: string | null;
  legalForm: string | null;
  siret: string | null;
  siren: string | null;
  vatNumber: string | null;
  shareCapital: number | null;
  registrationCity: string | null;
  representativeName: string | null;
  representativeRole: string | null;
};

type Props = {
  proprietaire: ProprietaireData;
};

function formatDateForInput(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date));
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

export function ProprietaireProfileForm({ proprietaire }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [entityType, setEntityType] = useState<ProprietaireEntityType>(proprietaire.entityType);

  const [form, setForm] = useState({
    label: proprietaire.label,
    firstName: proprietaire.firstName ?? "",
    lastName: proprietaire.lastName ?? "",
    phone: proprietaire.phone ?? "",
    birthDate: formatDateForInput(proprietaire.birthDate),
    birthPlace: proprietaire.birthPlace ?? "",
    address: proprietaire.address ?? "",
    postalCode: proprietaire.postalCode ?? "",
    city: proprietaire.city ?? "",
    profession: proprietaire.profession ?? "",
    nationality: proprietaire.nationality ?? "",
    companyName: proprietaire.companyName ?? "",
    legalForm: proprietaire.legalForm ?? "",
    siret: proprietaire.siret ?? "",
    siren: proprietaire.siren ?? "",
    vatNumber: proprietaire.vatNumber ?? "",
    shareCapital: proprietaire.shareCapital?.toString() ?? "",
    registrationCity: proprietaire.registrationCity ?? "",
    representativeName: proprietaire.representativeName ?? "",
    representativeRole: proprietaire.representativeRole ?? "",
  });

  function handleCancel() {
    setEntityType(proprietaire.entityType);
    setForm({
      label: proprietaire.label,
      firstName: proprietaire.firstName ?? "",
      lastName: proprietaire.lastName ?? "",
      phone: proprietaire.phone ?? "",
      birthDate: formatDateForInput(proprietaire.birthDate),
      birthPlace: proprietaire.birthPlace ?? "",
      address: proprietaire.address ?? "",
      postalCode: proprietaire.postalCode ?? "",
      city: proprietaire.city ?? "",
      profession: proprietaire.profession ?? "",
      nationality: proprietaire.nationality ?? "",
      companyName: proprietaire.companyName ?? "",
      legalForm: proprietaire.legalForm ?? "",
      siret: proprietaire.siret ?? "",
      siren: proprietaire.siren ?? "",
      vatNumber: proprietaire.vatNumber ?? "",
      shareCapital: proprietaire.shareCapital?.toString() ?? "",
      registrationCity: proprietaire.registrationCity ?? "",
      representativeName: proprietaire.representativeName ?? "",
      representativeRole: proprietaire.representativeRole ?? "",
    });
    setEditing(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProprietaire({
        id: proprietaire.id,
        label: form.label,
        entityType,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        birthDate: form.birthDate || undefined,
        birthPlace: form.birthPlace || undefined,
        address: form.address || undefined,
        postalCode: form.postalCode || undefined,
        city: form.city || undefined,
        profession: form.profession || undefined,
        nationality: form.nationality || undefined,
        companyName: form.companyName || undefined,
        legalForm: form.legalForm || undefined,
        siret: form.siret || undefined,
        siren: form.siren || undefined,
        vatNumber: form.vatNumber || undefined,
        shareCapital: form.shareCapital ? Number(form.shareCapital) : undefined,
        registrationCity: form.registrationCity || undefined,
        representativeName: form.representativeName || undefined,
        representativeRole: form.representativeRole || undefined,
      });
      if (result.success) {
        toast.success("Propriétaire mis à jour avec succès");
        setEditing(false);
      } else {
        toast.error(result.error ?? "Erreur lors de la mise à jour");
      }
    });
  }

  const isCompany = entityType === "PERSONNE_MORALE";
  const displayIsCompany = proprietaire.entityType === "PERSONNE_MORALE";

  // ── Read-only view ──
  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            {displayIsCompany ? (
              <Building2 className="h-5 w-5 text-muted-foreground" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle>
              {displayIsCompany ? "Fiche société" : "Fiche propriétaire"}
            </CardTitle>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {displayIsCompany ? "Personne morale" : "Personne physique"}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Libellé</p>
              <p className="text-sm font-medium">{proprietaire.label}</p>
            </div>

            {displayIsCompany ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Dénomination sociale</p>
                  <p className="text-sm font-medium">{proprietaire.companyName || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Forme juridique</p>
                  <p className="text-sm font-medium">{proprietaire.legalForm || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SIRET</p>
                  <p className="text-sm font-medium">{proprietaire.siret || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SIREN</p>
                  <p className="text-sm font-medium">{proprietaire.siren || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Capital social</p>
                  <p className="text-sm font-medium">{formatCurrency(proprietaire.shareCapital)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">N° TVA</p>
                  <p className="text-sm font-medium">{proprietaire.vatNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ville du RCS</p>
                  <p className="text-sm font-medium">{proprietaire.registrationCity || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Représentant légal</p>
                  <p className="text-sm font-medium">
                    {proprietaire.representativeName || "—"}
                    {proprietaire.representativeRole && ` (${proprietaire.representativeRole})`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="text-sm font-medium">{proprietaire.phone || "—"}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Prénom</p>
                  <p className="text-sm font-medium">{proprietaire.firstName || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="text-sm font-medium">{proprietaire.lastName || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="text-sm font-medium">{proprietaire.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date de naissance</p>
                  <p className="text-sm font-medium">{formatDateDisplay(proprietaire.birthDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lieu de naissance</p>
                  <p className="text-sm font-medium">{proprietaire.birthPlace || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profession</p>
                  <p className="text-sm font-medium">{proprietaire.profession || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nationalité</p>
                  <p className="text-sm font-medium">{proprietaire.nationality || "—"}</p>
                </div>
              </>
            )}
          </div>

          {/* Adresse */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">{displayIsCompany ? "Siège social" : "Adresse"}</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Adresse</p>
                <p className="text-sm font-medium">{proprietaire.address || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Code postal</p>
                <p className="text-sm font-medium">{proprietaire.postalCode || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ville</p>
                <p className="text-sm font-medium">{proprietaire.city || "—"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Edit form ──
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          {isCompany ? (
            <Building2 className="h-5 w-5 text-muted-foreground" />
          ) : (
            <User className="h-5 w-5 text-muted-foreground" />
          )}
          <CardTitle>
            {isCompany ? "Fiche société" : "Fiche propriétaire"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Entity type toggle */}
          <div className="space-y-2">
            <Label>Type de propriétaire</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEntityType("PERSONNE_PHYSIQUE")}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                  !isCompany ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <User className={`h-4 w-4 shrink-0 ${!isCompany ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Personne physique</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setEntityType("PERSONNE_MORALE")}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                  isCompany ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <Building2 className={`h-4 w-4 shrink-0 ${isCompany ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Personne morale</p>
                </div>
              </button>
            </div>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="label">Libellé *</Label>
            <Input id="label" name="label" value={form.label} onChange={handleChange} required />
          </div>

          {isCompany ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Dénomination sociale</Label>
                <Input id="companyName" name="companyName" value={form.companyName} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalForm">Forme juridique</Label>
                <select
                  id="legalForm"
                  name="legalForm"
                  value={form.legalForm}
                  onChange={handleChange}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Sélectionner...</option>
                  {LEGAL_FORMS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET</Label>
                <Input id="siret" name="siret" value={form.siret} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siren">SIREN</Label>
                <Input id="siren" name="siren" value={form.siren} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shareCapital">Capital social (€)</Label>
                <Input id="shareCapital" name="shareCapital" type="number" value={form.shareCapital} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">N° TVA intracommunautaire</Label>
                <Input id="vatNumber" name="vatNumber" value={form.vatNumber} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationCity">Ville du RCS</Label>
                <Input id="registrationCity" name="registrationCity" value={form.registrationCity} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="representativeName">Représentant légal</Label>
                <Input id="representativeName" name="representativeName" value={form.representativeName} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="representativeRole">Fonction</Label>
                <Input id="representativeRole" name="representativeRole" value={form.representativeRole} onChange={handleChange} placeholder="Gérant, Président..." />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Date de naissance</Label>
                <Input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthPlace">Lieu de naissance</Label>
                <Input id="birthPlace" name="birthPlace" value={form.birthPlace} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profession">Profession</Label>
                <Input id="profession" name="profession" value={form.profession} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationalité</Label>
                <Input id="nationality" name="nationality" value={form.nationality} onChange={handleChange} />
              </div>
            </div>
          )}

          {/* Adresse */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">{isCompany ? "Siège social" : "Adresse"}</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" name="address" value={form.address} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" value={form.city} onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Enregistrement..." : "Sauvegarder"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
