"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSociety } from "@/actions/society";
import { createPersonalSociety } from "@/actions/personal-society";
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
import { LEGAL_FORMS, TAX_REGIMES, VAT_REGIMES } from "@/lib/constants";
import { ArrowLeft, Loader2, Check, Search, Sparkles } from "lucide-react";
import Link from "next/link";

interface SiretResult {
  siret: string;
  siren: string;
  name: string;
  legalForm: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  tvaNumber: string;
  representantLegal: string;
}

export default function NouvelleSocietePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPhysique = searchParams.get("type") === "physique";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // SIRET search state
  const [siretQuery, setSiretQuery] = useState("");
  const [siretResults, setSiretResults] = useState<SiretResult[]>([]);
  const [siretSearching, setSiretSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Form controlled values (for auto-fill)
  const [formValues, setFormValues] = useState({
    name: "",
    legalForm: "",
    siret: "",
    vatNumber: "",
    addressLine1: "",
    postalCode: "",
    city: "",
    signatoryName: "",
  });

  // Form state for personne physique
  const [physForm, setPhysForm] = useState({
    siret: "",
    addressLine1: "",
    postalCode: "",
    city: "",
    taxRegime: "IR" as "IR" | "IS",
    vatRegime: "FRANCHISE" as "FRANCHISE" | "TVA",
  });
  const [physSuccess, setPhysSuccess] = useState(false);

  // SIRET search with debounce
  const searchSiret = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSiretResults([]);
      setShowResults(false);
      return;
    }
    setSiretSearching(true);
    try {
      const res = await fetch(`/api/public/siret?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSiretResults(data.results ?? []);
        setShowResults(true);
      }
    } catch {
      // silently ignore search errors
    } finally {
      setSiretSearching(false);
    }
  }, []);

  function handleSiretQueryChange(value: string) {
    setSiretQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchSiret(value), 400);
  }

  function selectSiretResult(result: SiretResult) {
    setFormValues({
      name: result.name,
      legalForm: result.legalForm,
      siret: result.siret,
      vatNumber: result.tvaNumber,
      addressLine1: result.addressLine1,
      postalCode: result.postalCode,
      city: result.city,
      signatoryName: result.representantLegal,
    });
    setShowResults(false);
    setSiretQuery("");
  }

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handlePhysiqueSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await createPersonalSociety({
      siret: physForm.siret || undefined,
      addressLine1: physForm.addressLine1 || undefined,
      postalCode: physForm.postalCode || undefined,
      city: physForm.city || undefined,
      taxRegime: physForm.taxRegime,
      vatRegime: physForm.vatRegime,
    });
    setIsLoading(false);
    if (result.success) {
      setPhysSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } else {
      setError(result.error ?? "Erreur lors de la création");
    }
  }

  if (isPhysique) {
    if (physSuccess) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-bold">Espace créé avec succès !</h2>
            <p className="text-muted-foreground">Redirection vers votre tableau de bord...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-xl mx-auto py-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Gestion en nom propre</h1>
          <p className="text-muted-foreground text-sm">
            Complétez les informations ci-dessous. Le SIRET est optionnel (utile si vous êtes loueur meublé non professionnel — LMNP).
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <form onSubmit={handlePhysiqueSubmit} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informations fiscales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phys-siret">SIRET (optionnel — LMNP, micro-foncier)</Label>
                <Input
                  id="phys-siret"
                  placeholder="12345678901234"
                  maxLength={14}
                  value={physForm.siret}
                  onChange={(e) => setPhysForm(prev => ({ ...prev, siret: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Si vous avez un SIRET en tant que loueur meublé, renseignez-le ici.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phys-taxRegime">Régime d&apos;imposition</Label>
                  <NativeSelect
                    id="phys-taxRegime"
                    options={[...TAX_REGIMES]}
                    value={physForm.taxRegime}
                    onChange={(e) => setPhysForm(prev => ({ ...prev, taxRegime: e.target.value as "IR" | "IS" }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phys-vatRegime">Régime TVA</Label>
                  <NativeSelect
                    id="phys-vatRegime"
                    options={[...VAT_REGIMES]}
                    value={physForm.vatRegime}
                    onChange={(e) => setPhysForm(prev => ({ ...prev, vatRegime: e.target.value as "TVA" | "FRANCHISE" }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Adresse (optionnel)</CardTitle>
              <CardDescription>Pré-remplie depuis votre profil si renseignée.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phys-address">Adresse</Label>
                <Input
                  id="phys-address"
                  value={physForm.addressLine1}
                  onChange={(e) => setPhysForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                  placeholder="12 rue de la Paix"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phys-postalCode">Code postal</Label>
                  <Input
                    id="phys-postalCode"
                    value={physForm.postalCode}
                    onChange={(e) => setPhysForm(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="75001"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phys-city">Ville</Label>
                  <Input
                    id="phys-city"
                    value={physForm.city}
                    onChange={(e) => setPhysForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Paris"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/proprietaire/setup")}
            >
              Retour
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Création...
                </>
              ) : (
                "Créer mon espace"
              )}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createSociety({
      name: data.name,
      legalForm: data.legalForm as "SCI" | "SARL" | "SAS" | "SA" | "EURL" | "SASU" | "SNC" | "AUTRE",
      siret: data.siret,
      vatNumber: data.vatNumber,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country || "France",
      taxRegime: data.taxRegime as "IS" | "IR",
      vatRegime: data.vatRegime as "TVA" | "FRANCHISE",
      iban: data.iban,
      bic: data.bic,
      bankName: data.bankName,
      accountantName: data.accountantName,
      accountantFirm: data.accountantFirm,
      accountantEmail: data.accountantEmail,
      accountantPhone: data.accountantPhone,
      invoicePrefix: data.invoicePrefix,
      legalMentions: data.legalMentions,
      shareCapital: data.shareCapital ? parseFloat(data.shareCapital) : undefined,
      signatoryName: data.signatoryName,
    });

    setIsLoading(false);

    if (result.success) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/societes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Nouvelle société
          </h1>
          <p className="text-muted-foreground">
            Créez une nouvelle société propriétaire
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Recherche SIRET auto-fill */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Remplissage automatique par SIRET
          </CardTitle>
          <CardDescription>
            Saisissez un numéro SIRET, SIREN ou le nom de la société pour pré-remplir les champs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative" ref={resultsRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par SIRET, SIREN ou nom..."
                value={siretQuery}
                onChange={(e) => handleSiretQueryChange(e.target.value)}
                className="pl-10 h-11"
              />
              {siretSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search results dropdown */}
            {showResults && siretResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {siretResults.map((result, i) => (
                  <button
                    key={result.siret || i}
                    type="button"
                    onClick={() => selectSiretResult(result)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                  >
                    <p className="font-medium text-sm">{result.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      SIRET: {result.siret} — {result.addressLine1}, {result.postalCode} {result.city}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {showResults && siretResults.length === 0 && !siretSearching && siretQuery.length >= 3 && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Aucun résultat trouvé</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identité */}
        <Card>
          <CardHeader>
            <CardTitle>Identité de la société</CardTitle>
            <CardDescription>
              Informations légales de la société propriétaire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Raison sociale *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  value={formValues.name}
                  onChange={(e) => setFormValues(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalForm">Forme juridique *</Label>
                <NativeSelect
                  id="legalForm"
                  name="legalForm"
                  options={[...LEGAL_FORMS]}
                  required
                  value={formValues.legalForm}
                  onChange={(e) => setFormValues(prev => ({ ...prev, legalForm: e.target.value }))}
                 />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET (14 chiffres) *</Label>
                <Input
                  id="siret"
                  name="siret"
                  placeholder="12345678901234"
                  maxLength={14}
                  required
                  value={formValues.siret}
                  onChange={(e) => setFormValues(prev => ({ ...prev, siret: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">N° TVA intracommunautaire</Label>
                <Input
                  id="vatNumber"
                  name="vatNumber"
                  placeholder="FR12345678901"
                  value={formValues.vatNumber}
                  onChange={(e) => setFormValues(prev => ({ ...prev, vatNumber: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shareCapital">Capital social (€)</Label>
                <Input
                  id="shareCapital"
                  name="shareCapital"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signatoryName">Représentant légal</Label>
                <Input
                  id="signatoryName"
                  name="signatoryName"
                  placeholder="M. DUPONT Jean, Gérant"
                  maxLength={100}
                  value={formValues.signatoryName}
                  onChange={(e) => setFormValues(prev => ({ ...prev, signatoryName: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="addressLine1">Adresse du siège *</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                required
                value={formValues.addressLine1}
                onChange={(e) => setFormValues(prev => ({ ...prev, addressLine1: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Complément d&apos;adresse</Label>
              <Input id="addressLine2" name="addressLine2" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal *</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  maxLength={5}
                  required
                  value={formValues.postalCode}
                  onChange={(e) => setFormValues(prev => ({ ...prev, postalCode: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  name="city"
                  required
                  value={formValues.city}
                  onChange={(e) => setFormValues(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
            </div>
            <input type="hidden" name="country" value="France" />
          </CardContent>
        </Card>

        {/* Fiscalité */}
        <Card>
          <CardHeader>
            <CardTitle>Régime fiscal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxRegime">Régime d&apos;imposition *</Label>
                <NativeSelect
                  id="taxRegime"
                  name="taxRegime"
                  options={[...TAX_REGIMES]}
                  required
                 />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatRegime">Régime TVA *</Label>
                <NativeSelect
                  id="vatRegime"
                  name="vatRegime"
                  options={[...VAT_REGIMES]}
                  required
                 />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Banque */}
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées bancaires</CardTitle>
            <CardDescription>
              Données chiffrées en base (AES-256)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">Banque</Label>
              <Input id="bankName" name="bankName" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input id="iban" name="iban" placeholder="FR76..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bic">BIC</Label>
                <Input id="bic" name="bic" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expert-comptable */}
        <Card>
          <CardHeader>
            <CardTitle>Expert-comptable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="accountantName">Nom</Label>
                <Input id="accountantName" name="accountantName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountantFirm">Cabinet</Label>
                <Input id="accountantFirm" name="accountantFirm" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="accountantEmail">Email</Label>
                <Input
                  id="accountantEmail"
                  name="accountantEmail"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountantPhone">Téléphone</Label>
                <Input id="accountantPhone" name="accountantPhone" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoicePrefix">
                Préfixe de numérotation des factures
              </Label>
              <Input
                id="invoicePrefix"
                name="invoicePrefix"
                placeholder="SCI1"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalMentions">
                Mentions légales personnalisées
              </Label>
              <Textarea
                id="legalMentions"
                name="legalMentions"
                rows={3}
                placeholder="Mentions apparaissant sur les quittances et courriers..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/societes">
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
              "Créer la société"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
