"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Check, User, Building2 } from "lucide-react";
import { createProprietaire } from "@/actions/proprietaire";
import { toast } from "sonner";
import Link from "next/link";
import type { ProprietaireEntityType } from "@/generated/prisma/client";

const LEGAL_FORMS = ["SCI", "SARL", "SAS", "SA", "EURL", "SASU", "SNC", "Holding", "Autre"];

export default function NouveauProprietairePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState<ProprietaireEntityType>("PERSONNE_PHYSIQUE");
  const [form, setForm] = useState({
    label: "",
    // Personne physique
    firstName: "",
    lastName: "",
    phone: "",
    birthDate: "",
    birthPlace: "",
    address: "",
    postalCode: "",
    city: "",
    profession: "",
    nationality: "",
    // Personne morale
    companyName: "",
    legalForm: "",
    siret: "",
    siren: "",
    vatNumber: "",
    shareCapital: "",
    registrationCity: "",
    representativeName: "",
    representativeRole: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) {
      toast.error("Le libellé est obligatoire");
      return;
    }
    setLoading(true);
    const result = await createProprietaire({
      label: form.label,
      entityType,
      // Personne physique
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
      // Personne morale
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
    setLoading(false);

    if (result.success && result.data) {
      toast.success("Propriétaire créé avec succès");
      router.push(`/proprietaire?pid=${result.data.id}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur lors de la création");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/proprietaire">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau propriétaire</h1>
          <p className="text-sm text-muted-foreground">
            Créez un nouveau profil propriétaire pour gérer un patrimoine distinct
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type d'entité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Type de propriétaire</CardTitle>
            <CardDescription>
              Un propriétaire peut être une personne physique ou une personne morale (holding, SCI, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEntityType("PERSONNE_PHYSIQUE")}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                  entityType === "PERSONNE_PHYSIQUE"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <User className={`h-5 w-5 shrink-0 ${entityType === "PERSONNE_PHYSIQUE" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Personne physique</p>
                  <p className="text-xs text-muted-foreground">Patrimoine personnel</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setEntityType("PERSONNE_MORALE")}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                  entityType === "PERSONNE_MORALE"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <Building2 className={`h-5 w-5 shrink-0 ${entityType === "PERSONNE_MORALE" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Personne morale</p>
                  <p className="text-xs text-muted-foreground">Holding, SCI, société...</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Identité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {entityType === "PERSONNE_PHYSIQUE" ? (
                <User className="h-4 w-4 text-primary" />
              ) : (
                <Building2 className="h-4 w-4 text-primary" />
              )}
              {entityType === "PERSONNE_PHYSIQUE" ? "Identité du propriétaire" : "Identité de la société"}
            </CardTitle>
            <CardDescription>
              Le libellé permet de distinguer vos différents patrimoines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="label">Libellé *</Label>
              <Input
                id="label"
                name="label"
                value={form.label}
                onChange={handleChange}
                placeholder={entityType === "PERSONNE_PHYSIQUE" ? "Ex: Patrimoine personnel" : "Ex: Holding Dupont"}
                required
              />
            </div>

            {entityType === "PERSONNE_PHYSIQUE" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate">Date de naissance</Label>
                    <Input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={handleChange} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="birthPlace">Lieu de naissance</Label>
                    <Input id="birthPlace" name="birthPlace" value={form.birthPlace} onChange={handleChange} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nationality">Nationalité</Label>
                    <Input id="nationality" name="nationality" value={form.nationality} onChange={handleChange} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profession">Profession</Label>
                    <Input id="profession" name="profession" value={form.profession} onChange={handleChange} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName">Dénomination sociale</Label>
                    <Input id="companyName" name="companyName" value={form.companyName} onChange={handleChange} placeholder="Nom de la société" />
                  </div>
                  <div className="space-y-1.5">
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="siret">SIRET</Label>
                    <Input id="siret" name="siret" value={form.siret} onChange={handleChange} placeholder="14 chiffres" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="siren">SIREN</Label>
                    <Input id="siren" name="siren" value={form.siren} onChange={handleChange} placeholder="9 chiffres" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="shareCapital">Capital social (€)</Label>
                    <Input id="shareCapital" name="shareCapital" type="number" value={form.shareCapital} onChange={handleChange} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vatNumber">N° TVA intracommunautaire</Label>
                    <Input id="vatNumber" name="vatNumber" value={form.vatNumber} onChange={handleChange} placeholder="FR..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="registrationCity">Ville du RCS</Label>
                  <Input id="registrationCity" name="registrationCity" value={form.registrationCity} onChange={handleChange} placeholder="Paris, Lyon..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="representativeName">Représentant légal</Label>
                    <Input id="representativeName" name="representativeName" value={form.representativeName} onChange={handleChange} placeholder="Nom complet" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="representativeRole">Fonction</Label>
                    <Input id="representativeRole" name="representativeRole" value={form.representativeRole} onChange={handleChange} placeholder="Gérant, Président..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {entityType === "PERSONNE_PHYSIQUE" ? "Adresse" : "Siège social"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse</Label>
              <Input id="address" name="address" value={form.address} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" value={form.city} onChange={handleChange} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/proprietaire">
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Création...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" /> Créer le propriétaire</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
