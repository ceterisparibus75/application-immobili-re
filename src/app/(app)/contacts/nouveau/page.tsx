"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createContact } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

const TYPE_OPTIONS = [
  { value: "PRESTATAIRE", label: "Prestataire" },
  { value: "NOTAIRE", label: "Notaire" },
  { value: "EXPERT", label: "Expert" },
  { value: "SYNDIC", label: "Syndic" },
  { value: "AGENCE", label: "Agence" },
  { value: "LOCATAIRE", label: "Locataire" },
  { value: "AUTRE", label: "Autre" },
];

export default function NouveauContactPage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSociety) return;

    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const result = await createContact(activeSociety.id, {
      contactType: data.contactType as "PRESTATAIRE" | "NOTAIRE" | "EXPERT" | "SYNDIC" | "AGENCE" | "LOCATAIRE" | "AUTRE",
      name: data.name,
      company: data.company || null,
      specialty: data.specialty || null,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      addressLine1: data.addressLine1 || null,
      city: data.city || null,
      postalCode: data.postalCode || null,
      notes: data.notes || null,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/contacts/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau contact</h1>
          <p className="text-muted-foreground">Prestataire, notaire, expert...</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations principales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactType">Type *</Label>
                <NativeSelect
                  id="contactType"
                  name="contactType"
                  options={TYPE_OPTIONS}
                  defaultValue="PRESTATAIRE"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nom / Prénom *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Nom complet"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Société</Label>
                <Input
                  id="company"
                  name="company"
                  placeholder="Raison sociale"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Spécialité / Fonction</Label>
                <Input
                  id="specialty"
                  name="specialty"
                  placeholder="Ex: Plomberie, Droit immobilier..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone fixe</Label>
                <Input id="phone" name="phone" type="tel" placeholder="01 23 45 67 89" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" name="mobile" type="tel" placeholder="06 12 34 56 78" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="contact@exemple.fr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Adresse</Label>
              <Input id="addressLine1" name="addressLine1" placeholder="Numéro et rue" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" name="postalCode" placeholder="75001" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" placeholder="Paris" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Informations complémentaires, conditions tarifaires..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/contacts">
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
              "Créer le contact"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
