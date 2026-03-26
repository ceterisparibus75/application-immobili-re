"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTenant } from "@/actions/tenant";
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
import { ArrowLeft, Building2, Loader2, User } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";
import { cn } from "@/lib/utils";

const RISK_OPTIONS = [
  { value: "VERT", label: "Vert — Aucun risque" },
  { value: "ORANGE", label: "Orange — Vigilance" },
  { value: "ROUGE", label: "Rouge — Risque élevé" },
];

const LEGAL_FORM_OPTIONS = [
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

export default function NouveauLocatairePage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [entityType, setEntityType] = useState<"PERSONNE_MORALE" | "PERSONNE_PHYSIQUE">(
    "PERSONNE_MORALE"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

    const input =
      entityType === "PERSONNE_MORALE"
        ? {
            entityType: "PERSONNE_MORALE" as const,
            companyName: data.companyName,
            companyLegalForm: data.companyLegalForm,
            siret: data.siret || undefined,
            siren: data.siren || undefined,
            codeAPE: data.codeAPE || undefined,
            vatNumber: data.vatNumber || undefined,
            companyAddress: data.companyAddress || undefined,
            shareCapital: data.shareCapital ? parseFloat(data.shareCapital) : undefined,
            legalRepName: data.legalRepName || undefined,
            legalRepTitle: data.legalRepTitle || undefined,
            legalRepEmail: data.legalRepEmail || undefined,
            legalRepPhone: data.legalRepPhone || undefined,
            email: data.email,
            billingEmail: data.billingEmail || undefined,
            phone: data.phone || undefined,
            mobile: data.mobile || undefined,
            riskIndicator: (data.riskIndicator as "VERT" | "ORANGE" | "ROUGE") || "VERT",
            notes: data.notes || undefined,
          }
        : {
            entityType: "PERSONNE_PHYSIQUE" as const,
            lastName: data.lastName,
            firstName: data.firstName,
            birthDate: data.birthDate || undefined,
            birthPlace: data.birthPlace || undefined,
            personalAddress: data.personalAddress || undefined,
            autoEntrepreneurSiret: data.autoEntrepreneurSiret || undefined,
            email: data.email,
            billingEmail: data.billingEmail || undefined,
            phone: data.phone || undefined,
            mobile: data.mobile || undefined,
            riskIndicator: (data.riskIndicator as "VERT" | "ORANGE" | "ROUGE") || "VERT",
            notes: data.notes || undefined,
          };

    const result = await createTenant(activeSociety.id, input);

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/locataires/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/locataires">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Nouveau locataire
          </h1>
          <p className="text-muted-foreground">
            Créez un dossier locataire
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Toggle type */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEntityType("PERSONNE_MORALE")}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors flex-1 justify-center",
            entityType === "PERSONNE_MORALE"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-primary/50"
          )}
        >
          <Building2 className="h-4 w-4" />
          Personne morale
        </button>
        <button
          type="button"
          onClick={() => setEntityType("PERSONNE_PHYSIQUE")}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors flex-1 justify-center",
            entityType === "PERSONNE_PHYSIQUE"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-primary/50"
          )}
        >
          <User className="h-4 w-4" />
          Personne physique
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="entityType" value={entityType} />

        {/* Personne morale */}
        {entityType === "PERSONNE_MORALE" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Société locataire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="companyName">Raison sociale *</Label>
                    <Input id="companyName" name="companyName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyLegalForm">Forme juridique</Label>
                    <NativeSelect
                      id="companyLegalForm"
                      name="companyLegalForm"
                      options={LEGAL_FORM_OPTIONS}
                      placeholder="Choisir..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="siret">SIRET (14 chiffres)</Label>
                    <Input
                      id="siret"
                      name="siret"
                      maxLength={14}
                      placeholder="12345678901234"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codeAPE">Code APE / NAF</Label>
                    <Input id="codeAPE" name="codeAPE" placeholder="6820A" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">N° TVA intracommunautaire</Label>
                    <Input id="vatNumber" name="vatNumber" placeholder="FR12..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shareCapital">Capital social (€)</Label>
                    <Input
                      id="shareCapital"
                      name="shareCapital"
                      type="number"
                      min={0}
                      step={0.01}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Adresse du siège</Label>
                  <Input id="companyAddress" name="companyAddress" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Représentant légal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="legalRepName">Nom</Label>
                    <Input id="legalRepName" name="legalRepName" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalRepTitle">Qualité</Label>
                    <Input
                      id="legalRepTitle"
                      name="legalRepTitle"
                      placeholder="Gérant, Président..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalRepEmail">Email</Label>
                    <Input
                      id="legalRepEmail"
                      name="legalRepEmail"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalRepPhone">Téléphone</Label>
                    <Input id="legalRepPhone" name="legalRepPhone" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Personne physique */}
        {entityType === "PERSONNE_PHYSIQUE" && (
          <Card>
            <CardHeader>
              <CardTitle>Identité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input id="lastName" name="lastName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input id="firstName" name="firstName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Date de naissance</Label>
                  <Input id="birthDate" name="birthDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthPlace">Lieu de naissance</Label>
                  <Input id="birthPlace" name="birthPlace" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="personalAddress">Adresse personnelle</Label>
                <Input id="personalAddress" name="personalAddress" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autoEntrepreneurSiret">
                  SIRET auto-entrepreneur (si applicable)
                </Label>
                <Input
                  id="autoEntrepreneurSiret"
                  name="autoEntrepreneurSiret"
                  maxLength={14}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact commun */}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email principal *</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Email de facturation</Label>
                <Input id="billingEmail" name="billingEmail" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone fixe</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" name="mobile" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gestion du risque */}
        <Card>
          <CardHeader>
            <CardTitle>Gestion du risque</CardTitle>
            <CardDescription>
              Indicateur interne de suivi du locataire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="riskIndicator">Indicateur de risque</Label>
              <NativeSelect
                id="riskIndicator"
                name="riskIndicator"
                options={RISK_OPTIONS}
                defaultValue="VERT"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Observations, historique, informations importantes..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/locataires">
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
              "Créer le locataire"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
