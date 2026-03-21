"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createMaintenance } from "@/actions/maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSociety } from "@/providers/society-provider";

export default function NouvelleMaintenancePage() {
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

    const result = await createMaintenance(activeSociety.id, {
      buildingId: params.id,
      title: data.title,
      description: data.description,
      scheduledAt: data.scheduledAt || null,
      completedAt: data.completedAt || null,
      cost: data.cost ? parseFloat(data.cost) : undefined,
      isPaid: data.isPaid === "on",
      notes: data.notes,
    });

    setIsLoading(false);

    if (result.success) {
      router.push(`/patrimoine/immeubles/${params.id}`);
    } else {
      setError(result.error ?? "Erreur inconnue");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/patrimoine/immeubles/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Nouvelle intervention
          </h1>
          <p className="text-muted-foreground">
            Travaux, maintenance, sinistre...
          </p>
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
            <CardTitle>Intervention</CardTitle>
            <CardDescription>
              Travaux, réparation, maintenance préventive...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                name="title"
                placeholder="Ex: Réfection toiture, Remplacement chaudière..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Détails de l'intervention..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Date prévue</Label>
                <Input id="scheduledAt" name="scheduledAt" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="completedAt">Date de réalisation</Label>
                <Input id="completedAt" name="completedAt" type="date" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coût</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cost">Montant TTC (€)</Label>
                <Input
                  id="cost"
                  name="cost"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isPaid"
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Facture payée</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Prestataire, numéro de devis, garantie..."
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
              "Enregistrer l'intervention"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
