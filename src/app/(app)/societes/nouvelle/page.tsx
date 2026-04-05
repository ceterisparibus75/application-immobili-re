"use client";

import { useState, useEffect } from "react";
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
import { ArrowLeft, Loader2, Check } from "lucide-react";
import Link from "next/link";

export default function NouvelleSocietePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPhysique = searchParams.get("type") === "physique";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Pour personne physique : créer automatiquement la société personnelle
  useEffect(() => {
    if (!isPhysique) return;

    let cancelled = false;
    async function autoCreate() {
      setIsLoading(true);
      const result = await createPersonalSociety();
      if (cancelled) return;
      setIsLoading(false);
      if (result.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error ?? "Erreur lors de la création");
      }
    }
    autoCreate();
    return () => { cancelled = true; };
  }, [isPhysique, router]);

  if (isPhysique) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          {isLoading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Création de votre espace propriétaire...</p>
            </>
          ) : error ? (
            <>
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
              <Button onClick={() => router.push("/proprietaire/setup")}>Retour</Button>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
                <Check className="h-7 w-7 text-green-600" />
              </div>
              <p className="text-muted-foreground">Redirection vers votre tableau de bord...</p>
            </>
          )}
        </div>
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
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalForm">Forme juridique *</Label>
                <NativeSelect
                  id="legalForm"
                  name="legalForm"
                  options={[...LEGAL_FORMS]}
                  required
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">N° TVA intracommunautaire</Label>
                <Input
                  id="vatNumber"
                  name="vatNumber"
                  placeholder="FR12345678901"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="addressLine1">Adresse du siège *</Label>
              <Input id="addressLine1" name="addressLine1" required />
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input id="city" name="city" required />
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
