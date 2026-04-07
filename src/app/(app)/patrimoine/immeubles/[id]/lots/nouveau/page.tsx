"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createLot } from "@/actions/lot";
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
import { LOT_TYPES, LOT_STATUSES, EXPLOITATION_STATUSES } from "@/lib/constants";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

export default function NouveauLotPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
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

    const result = await createLot(activeSociety.id, {
      buildingId: params.id,
      number: data.number,
      lotType: data.lotType as
        | "LOCAL_COMMERCIAL"
        | "BUREAUX"
        | "LOCAL_ACTIVITE"
        | "RESERVE"
        | "PARKING"
        | "CAVE"
        | "TERRASSE"
        | "ENTREPOT"
        | "APPARTEMENT",
      area: parseFloat(data.area),
      commonShares: data.commonShares ? parseInt(data.commonShares) : undefined,
      floor: data.floor,
      position: data.position,
      description: data.description,
      status: (data.status as "OCCUPE" | "VACANT" | "EN_TRAVAUX" | "RESERVE") || "VACANT",
      exploitationStatus: data.exploitationStatus || "INCONNU",
      marketRentValue: data.marketRentValue ? parseFloat(data.marketRentValue) : undefined,
      currentRent: data.currentRent ? parseFloat(data.currentRent) : undefined,
    });

    setIsLoading(false);

    if (result.success && result.data) {
      router.push(`/patrimoine/immeubles/${params.id}/lots/${result.data.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
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
          <h1 className="text-2xl font-bold tracking-tight">Nouveau lot</h1>
          <p className="text-muted-foreground">
            Ajouter un lot à cet immeuble
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
            <CardTitle>Identification du lot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="number">Numéro de lot *</Label>
                <Input
                  id="number"
                  name="number"
                  placeholder="Ex: 101, A1, RDC-01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lotType">Type *</Label>
                <NativeSelect
                  id="lotType"
                  name="lotType"
                  options={[...LOT_TYPES]}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="floor">Étage</Label>
                <Input
                  id="floor"
                  name="floor"
                  placeholder="Ex: RDC, 1, 2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  name="position"
                  placeholder="Ex: Aile gauche, Façade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <NativeSelect
                  id="status"
                  name="status"
                  options={[...LOT_STATUSES]}
                  defaultValue="VACANT"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exploitationStatus">Statut d&apos;exploitation</Label>
              <NativeSelect
                id="exploitationStatus"
                name="exploitationStatus"
                options={[...EXPLOITATION_STATUSES]}
                defaultValue="INCONNU"
              />
            </div>
          </CardContent>
        </Card>

        {/* Surface et tantièmes */}
        <Card>
          <CardHeader>
            <CardTitle>Surface et charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="area">Surface privative (m²) *</Label>
                <Input
                  id="area"
                  name="area"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commonShares">Tantièmes</Label>
                <Input
                  id="commonShares"
                  name="commonShares"
                  type="number"
                  min={0}
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loyer */}
        <Card>
          <CardHeader>
            <CardTitle>Valeur locative</CardTitle>
            <CardDescription>
              Informations sur le loyer pratiqué ou de marché
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marketRentValue">
                  Valeur locative de marché (€ HT/mois)
                </Label>
                <Input
                  id="marketRentValue"
                  name="marketRentValue"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentRent">Loyer pratiqué (€ HT/mois)</Label>
                <Input
                  id="currentRent"
                  name="currentRent"
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
                rows={2}
                placeholder="Informations complémentaires sur le lot..."
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
                Création...
              </>
            ) : (
              "Créer le lot"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
