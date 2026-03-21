"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { updateBuilding } from "@/actions/building";
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

type Building = {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  buildingType: "BUREAU" | "COMMERCE" | "MIXTE" | "ENTREPOT";
  yearBuilt: number | null;
  totalArea: number | null;
  marketValue: number | null;
  netBookValue: number | null;
  description: string | null;
};

export default function ModifierImmeubleePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { activeSociety } = useSociety();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [building, setBuilding] = useState<Building | null>(null);

  useEffect(() => {
    async function fetchBuilding() {
      try {
        const res = await fetch(`/api/buildings/${params.id}`);
        if (res.ok) {
          const json = await res.json() as { data: Building };
          setBuilding(json.data);
        }
      } finally {
        setIsFetching(false);
      }
    }
    void fetchBuilding();
  }, [params.id]);

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

    const result = await updateBuilding(activeSociety.id, {
      id: params.id,
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

    if (result.success) {
      router.push(`/patrimoine/immeubles/${params.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!building) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Immeuble introuvable
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/patrimoine/immeubles/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Modifier l'immeuble
          </h1>
          <p className="text-muted-foreground">{building.name}</p>
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
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Nom de l'immeuble *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={building.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildingType">Type *</Label>
                <Select
                  id="buildingType"
                  name="buildingType"
                  options={[...BUILDING_TYPES]}
                  defaultValue={building.buildingType}
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
                  defaultValue={building.yearBuilt ?? ""}
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
                defaultValue={building.addressLine1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Complément d'adresse</Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                defaultValue={building.addressLine2 ?? ""}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal *</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  maxLength={5}
                  defaultValue={building.postalCode}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={building.city}
                  required
                />
              </div>
            </div>
            <input type="hidden" name="country" value="France" />
          </CardContent>
        </Card>

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
                  defaultValue={building.totalArea ?? ""}
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
                  defaultValue={building.marketValue ?? ""}
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
                  defaultValue={building.netBookValue ?? ""}
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
                defaultValue={building.description ?? ""}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/patrimoine/immeubles/${params.id}`}>
            <Button variant="outline" type="button">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
