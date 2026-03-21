"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBuilding } from "@/actions/building";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BUILDING_TYPES } from "@/lib/constants";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

export default function NouvelImmeubleePage() {
  const router = useRouter();
  const { activeSociety } = useSociety();
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

    const result = await createBuilding(activeSociety.id, {
      name: data.name,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country || "France",
      buildingType: data.buildingType as "BUREAU" | "COMMERCE" | "MIXTE" | "ENTREPOT",
      yearBuilt: data.yearBuilt ? parseInt(data.yearBuilt) : undefined,
      totalArea: data.totalArea ? parseFloat(data.totalArea) : undefined,
      marketValue: data.marketValue ? parseFloat(data.marketValue) : undefined,
      netBookValue: data.netBookValue ? parseFloat(data.netBookValue) : undefined,
      description: data.description,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/patrimoine/immeubles/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/patrimoine/immeubles">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvel immeuble</h1>
          <p className="text-muted-foreground">
            Ajoutez un immeuble à votre patrimoine
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identification */}
        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Nom de l'immeuble *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex: Immeuble Le Châtelet"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildingType">Type *</Label>
                <Select
                  id="buildingType"
                  name="buildingType"
                  options={[...BUILDING_TYPES]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearBuilt">Année de construction</Label>
                <Input
                  id="yearBuilt"
                  name="yearBuilt"
                  type="number"
                  min={1800}
                  max={new Date().getFullYear()}
                  placeholder="Ex: 1985"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader>
            <CardTitle>Adresse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Adresse *</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                placeholder="Numéro et nom de rue"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Complément d'adresse</Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                placeholder="Bâtiment, étage..."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal *</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  maxLength={5}
                  placeholder="75001"
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

        {/* Valorisation */}
        <Card>
          <CardHeader>
            <CardTitle>Valorisation</CardTitle>
            <CardDescription>Informations financières et surfaces</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="totalArea">Surface totale (m²)</Label>
                <Input
                  id="totalArea"
                  name="totalArea"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marketValue">Valeur vénale (€)</Label>
                <Input
                  id="marketValue"
                  name="marketValue"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="netBookValue">Valeur comptable nette (€)</Label>
                <Input
                  id="netBookValue"
                  name="netBookValue"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Informations complémentaires sur l'immeuble..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/patrimoine/immeubles">
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
              "Créer l'immeuble"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
